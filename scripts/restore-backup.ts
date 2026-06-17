/**
 * Manual database restore from a stored backup.
 *
 * Usage:
 *   npx tsx scripts/restore-backup.ts            # restore the LATEST complete backup
 *   npx tsx scripts/restore-backup.ts <backupId> # restore a specific backup
 *
 * DESTRUCTIVE: clears each collection present in the archive and re-inserts it.
 * Run only during a recovery. The connection string is resolved exactly like the
 * app (lib/db), so it targets the same database the app is using.
 *
 * Self-contained on purpose (does not import lib/backup, which is server-only and
 * cannot be loaded in a plain Node/tsx process).
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import { prisma, getMongoUrl } from "../lib/db";

const gunzip = promisify(zlib.gunzip);
const BACKUP_DIR = process.env.BACKUP_DIR || "/app/backups";

interface Archive {
  collections: Record<string, unknown[]>;
}

async function loadBytes(id: string): Promise<{ filename: string; data: Buffer }> {
  const b = await prisma.dbBackup.findUnique({ where: { id } });
  if (!b) throw new Error(`Backup ${id} not found`);
  if (b.inDb && b.archive) return { filename: b.filename, data: Buffer.from(b.archive) };
  const p = path.join(BACKUP_DIR, b.filename);
  if (!fs.existsSync(p)) throw new Error(`Backup archive not found (db + disk): ${b.filename}`);
  return { filename: b.filename, data: fs.readFileSync(p) };
}

async function main() {
  const url = getMongoUrl();
  if (!url) throw new Error("MONGO_URL is not configured");

  let id = process.argv[2];
  if (!id) {
    const latest = await prisma.dbBackup.findFirst({
      where: { status: "complete" },
      orderBy: { createdAt: "desc" },
      select: { id: true, dateKey: true, createdAt: true },
    });
    if (!latest) throw new Error("No completed backups found.");
    id = latest.id;
    console.log(`Restoring latest backup ${latest.dateKey} (${latest.createdAt.toISOString()})…`);
  } else {
    console.log(`Restoring backup ${id}…`);
  }

  const { data } = await loadBytes(id);
  const archive = EJSON.parse((await gunzip(data)).toString("utf8"), { relaxed: false }) as Archive;

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    for (const [name, docs] of Object.entries(archive.collections)) {
      const coll = db.collection(name);
      await coll.deleteMany({});
      if (Array.isArray(docs) && docs.length) {
        await coll.insertMany(docs as Record<string, unknown>[], { ordered: false });
      }
      console.log(`  ${name}: ${Array.isArray(docs) ? docs.length : 0}`);
    }
    console.log("Restore complete.");
  } finally {
    await client.close().catch(() => {});
  }
}

main()
  .catch((e) => {
    console.error("Restore failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
