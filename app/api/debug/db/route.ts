import { NextResponse } from "next/server";
import fs from "fs";
import { prisma } from "@/lib/db";

// TEMPORARY diagnostic endpoint to debug the production DB connection.
// Safe: redacts all credentials, never prints the password/user portion of the
// connection string. Remove once the production login is confirmed working.

function redact(url?: string | null) {
  if (!url) return null;
  const schemeEnd = url.indexOf("://");
  if (schemeEnd === -1) return { malformed: true };
  const scheme = url.slice(0, schemeEnd);
  let after = url.slice(schemeEnd + 3);
  const at = after.indexOf("@");
  if (at !== -1) after = after.slice(at + 1); // drop user:pass
  const qIdx = after.indexOf("?");
  const beforeQuery = qIdx === -1 ? after : after.slice(0, qIdx);
  const slash = beforeQuery.indexOf("/");
  const host = slash === -1 ? beforeQuery : beforeQuery.slice(0, slash);
  const dbPath = slash === -1 ? "" : beforeQuery.slice(slash + 1);
  return { scheme, host, dbInPath: dbPath || null, hasDbName: dbPath.length > 0 };
}

function fileMongo(p: string) {
  try {
    const t = fs.readFileSync(p, "utf8");
    const m = t.match(/^\s*MONGO_URL\s*=\s*(.*)$/m);
    const d = t.match(/^\s*DB_NAME\s*=\s*(.*)$/m);
    return { exists: true, mongo: m ? redact(m[1].trim()) : null, dbName: d ? d[1].trim() : null };
  } catch {
    return { exists: false };
  }
}

export async function GET() {
  const info: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV ?? null,
    nextRuntime: process.env.NEXT_RUNTIME ?? null,
    envMongoSet: Boolean(process.env.MONGO_URL),
    envMongo: redact(process.env.MONGO_URL),
    envDbName: process.env.DB_NAME ?? null,
    emergentKeySet: Boolean(process.env.EMERGENT_LLM_KEY),
    rootDotEnv: fileMongo("/app/.env"),
    backendDotEnv: fileMongo("/app/backend/.env"),
  };
  try {
    const count = await prisma.user.count();
    info.dbOk = true;
    info.userCount = count;
  } catch (e) {
    info.dbOk = false;
    info.dbError =
      e instanceof Error
        ? `${e.name}: ${e.message}`.slice(0, 1000)
        : String(e).slice(0, 1000);
  }
  return NextResponse.json(info);
}
