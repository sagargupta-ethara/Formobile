import "server-only";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { MongoClient } from "mongodb";
import { EJSON } from "bson";
import cron from "node-cron";
import { prisma, getMongoUrl } from "./db";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve("/app/backups");
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const MAX_INDB_BYTES = 15 * 1024 * 1024; // stay safely under Mongo's 16MB doc cap
const CRON_EXPR = process.env.BACKUP_CRON || "0 0 * * *"; // every day at midnight
const CRON_TZ = process.env.BACKUP_TZ || "Asia/Kolkata";
// Collections we never include in a dump (the backups themselves + system).
const EXCLUDED = new Set(["DbBackup"]);

interface Archive {
  version: number;
  createdAt: string;
  db: string;
  collections: Record<string, unknown[]>;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function dayKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function timeKey(d = new Date()): string {
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function isUniqueError(e: unknown): boolean {
  return e instanceof Error && (e as { code?: string }).code === "P2002";
}

/** Ensure the unique index backing the once-per-day scheduled claim exists.
 *  (Prisma's @unique isn't enforced on MongoDB without the actual index.) */
async function ensureIndexes(): Promise<void> {
  try {
    await prisma.$runCommandRaw({
      createIndexes: "DbBackup",
      indexes: [{ key: { dateKey: 1 }, name: "dateKey_unique", unique: true }],
    });
  } catch {
    /* index may already exist — ignore */
  }
}

/**
 * Take a full logical backup of the database (every collection except the
 * backups collection), gzip it, store the archive bytes in the DB (durable on
 * Atlas) and also write a copy to BACKUP_DIR. Enforces retention afterwards.
 *
 * `scheduled` backups are claimed once per calendar day (atomic via the unique
 * dateKey) so concurrent replicas don't double-run. `manual` backups always run.
 */
export async function createBackup(
  trigger: "scheduled" | "manual"
): Promise<{ id?: string; dateKey: string; sizeBytes?: number; skipped?: boolean }> {
  const url = getMongoUrl();
  if (!url) throw new Error("MONGO_URL is not configured");

  await ensureIndexes();

  const day = dayKey();
  const dateKey = trigger === "scheduled" ? day : `${day}-${timeKey()}`;
  const filename = `${dateKey}.json.gz`;

  // claim the slot
  let rec;
  try {
    rec = await prisma.dbBackup.create({
      data: { dateKey, trigger, status: "running", filename, inDb: false },
    });
  } catch (e) {
    if (isUniqueError(e)) return { dateKey, skipped: true }; // today already done
    throw e;
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db();
    const names = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .filter((n) => !EXCLUDED.has(n) && !n.startsWith("system."));

    const collections: Record<string, unknown[]> = {};
    const stats: Record<string, number> = {};
    for (const name of names) {
      const docs = await db.collection(name).find({}).toArray();
      collections[name] = docs;
      stats[name] = docs.length;
    }

    const archive: Archive = {
      version: 1,
      createdAt: new Date().toISOString(),
      db: db.databaseName,
      collections,
    };
    const ejson = EJSON.stringify(archive, undefined, 0, { relaxed: false });
    const gz = await gzip(Buffer.from(ejson, "utf8"));
    const sizeBytes = gz.byteLength;

    // write file copy
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.writeFileSync(path.join(BACKUP_DIR, filename), gz);

    const inDb = sizeBytes <= MAX_INDB_BYTES;
    await prisma.dbBackup.update({
      where: { id: rec.id },
      data: {
        status: "complete",
        sizeBytes,
        stats: stats as object,
        archive: inDb ? gz : null,
        inDb,
      },
    });

    await enforceRetention();
    return { id: rec.id, dateKey, sizeBytes };
  } catch (e) {
    await prisma.dbBackup
      .update({
        where: { id: rec.id },
        data: { status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 500) },
      })
      .catch(() => {});
    throw e;
  } finally {
    await client.close().catch(() => {});
  }
}

/** Keep only the most recent RETENTION_DAYS backups; delete older docs + files. */
export async function enforceRetention(): Promise<void> {
  const all = await prisma.dbBackup.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, filename: true },
  });
  const stale = all.slice(RETENTION_DAYS);
  for (const b of stale) {
    try {
      fs.rmSync(path.join(BACKUP_DIR, b.filename), { force: true });
    } catch {
      /* file may already be gone (ephemeral disk) */
    }
    await prisma.dbBackup.delete({ where: { id: b.id } }).catch(() => {});
  }
}

/** Raw gzipped archive bytes for a backup (from DB, falling back to disk). */
export async function getBackupBytes(id: string): Promise<{ filename: string; data: Buffer } | null> {
  const b = await prisma.dbBackup.findUnique({ where: { id } });
  if (!b) return null;
  if (b.inDb && b.archive) return { filename: b.filename, data: Buffer.from(b.archive) };
  const p = path.join(BACKUP_DIR, b.filename);
  if (fs.existsSync(p)) return { filename: b.filename, data: fs.readFileSync(p) };
  return null;
}

/**
 * Restore the database from a stored backup. Destructive: by default each
 * collection in the archive is cleared and re-inserted. Used for manual
 * recovery (not exposed as a UI button).
 */
export async function restoreBackup(
  id: string,
  opts: { drop?: boolean } = {}
): Promise<{ restored: Record<string, number> }> {
  const url = getMongoUrl();
  if (!url) throw new Error("MONGO_URL is not configured");
  const got = await getBackupBytes(id);
  if (!got) throw new Error("Backup archive not found");

  const json = (await gunzip(got.data)).toString("utf8");
  const archive = EJSON.parse(json, { relaxed: false }) as Archive;

  const client = new MongoClient(url);
  const restored: Record<string, number> = {};
  try {
    await client.connect();
    const db = client.db();
    for (const [name, docs] of Object.entries(archive.collections)) {
      const coll = db.collection(name);
      if (opts.drop !== false) await coll.deleteMany({});
      if (Array.isArray(docs) && docs.length) {
        await coll.insertMany(docs as Record<string, unknown>[], { ordered: false });
      }
      restored[name] = Array.isArray(docs) ? docs.length : 0;
    }
    return { restored };
  } finally {
    await client.close().catch(() => {});
  }
}

let scheduled = false;
/** Register the daily midnight backup cron. Safe to call multiple times. */
export function scheduleBackups(): void {
  if (scheduled) return;
  scheduled = true;
  if (!cron.validate(CRON_EXPR)) {
    console.error("[backup] invalid BACKUP_CRON, scheduler not started:", CRON_EXPR);
    return;
  }
  cron.schedule(
    CRON_EXPR,
    () => {
      createBackup("scheduled")
        .then((r) =>
          console.log(
            r.skipped
              ? `[backup] ${r.dateKey} already exists — skipped`
              : `[backup] completed ${r.dateKey} (${r.sizeBytes} bytes)`
          )
        )
        .catch((e) => console.error("[backup] scheduled run failed:", e));
    },
    { timezone: CRON_TZ }
  );
  console.log(`[backup] scheduled "${CRON_EXPR}" (tz ${CRON_TZ}); retention ${RETENTION_DAYS} days.`);
}
