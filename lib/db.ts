import { PrismaClient } from "@prisma/client";
import fs from "fs";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Minimal .env parser (split on first `=`, strip optional quotes). */
function readEnvFile(p: string): Record<string, string> {
  try {
    const text = fs.readFileSync(p, "utf8");
    const out: Record<string, string> = {};
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key) out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Ensure the Mongo URL carries a database name in its path. Prisma's mongodb
 * connector requires it, but Emergent's managed Atlas MONGO_URL is typically
 * injected WITHOUT a db path (the db name comes from DB_NAME separately).
 * Preserves an existing db path and any query string.
 */
// Query-string options that Prisma's mongodb connector rejects (Emergent's
// managed Atlas URL ships some of these, e.g. timeoutMS).
const UNSUPPORTED_QUERY_PARAMS = new Set(["timeoutms"]);

function sanitizeQuery(query: string): string {
  if (!query || query === "?") return "";
  const kept = query
    .slice(1)
    .split("&")
    .filter((pair) => {
      if (!pair) return false;
      const key = pair.split("=")[0].toLowerCase();
      return !UNSUPPORTED_QUERY_PARAMS.has(key);
    });
  return kept.length ? `?${kept.join("&")}` : "";
}

function withDatabase(rawUrl: string, dbName?: string): string {
  const schemeEnd = rawUrl.indexOf("://");
  if (schemeEnd === -1) return rawUrl;

  const qIdx = rawUrl.indexOf("?");
  const query = sanitizeQuery(qIdx === -1 ? "" : rawUrl.slice(qIdx));
  const base = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);

  const afterScheme = base.slice(schemeEnd + 3);
  const slashIdx = afterScheme.indexOf("/");
  const hostPart = slashIdx === -1 ? afterScheme : afterScheme.slice(0, slashIdx);
  const existingDb = slashIdx === -1 ? "" : afterScheme.slice(slashIdx + 1);

  const db = existingDb && existingDb.length > 0 ? existingDb : dbName || "";
  const scheme = base.slice(0, schemeEnd + 3);
  return `${scheme}${hostPart}/${db}${query}`;
}

/**
 * Resolve the Prisma connection string independently of how Next.js was
 * launched. Order: real process env first, then /app/backend/.env (where
 * Emergent injects managed values), then /app/.env (preview/local).
 */
function resolveMongoUrl(): string | undefined {
  let url = process.env.MONGO_URL;
  let db = process.env.DB_NAME;

  if (!url || !db) {
    const fromFiles = {
      ...readEnvFile("/app/.env"),
      ...readEnvFile("/app/backend/.env"),
    };
    url = url || fromFiles.MONGO_URL;
    db = db || fromFiles.DB_NAME;
  }

  if (!url) return undefined;
  return withDatabase(url, db);
}

const datasourceUrl = resolveMongoUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
