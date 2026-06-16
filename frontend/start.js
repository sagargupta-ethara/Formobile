#!/usr/bin/env node
/**
 * Production-safe launcher for the Next.js app (runs in the Emergent "frontend"
 * supervisor slot).
 *
 * Why this exists:
 *  - The Next.js app (which runs all Prisma queries) needs MONGO_URL / DB_NAME /
 *    JWT_SECRET in its process environment.
 *  - In PREVIEW these live in /app/.env (auto-loaded by Next.js).
 *  - In PRODUCTION /app/.env is gitignored and never deployed; Emergent instead
 *    injects the managed values into /app/backend/.env. Next.js never reads that
 *    file, so MONGO_URL was undefined in prod and login 500'd.
 *
 * This loader reads /app/backend/.env (and falls back to /app/.env), folds the
 * managed DB_NAME into the Mongo connection string when the URL has no database
 * path (Prisma's mongodb connector requires the db name in the URL), then execs
 * `next start`.
 */
const fs = require("fs");
const { spawn } = require("child_process");

function parseEnvFile(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  const text = fs.readFileSync(path, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // strip surrounding quotes if present
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Ensure the Mongo URL carries a database name in its path (required by Prisma's
 * mongodb connector). Preserves any existing db path and query string.
 */
function withDatabase(rawUrl, dbName) {
  if (!rawUrl) return rawUrl;
  const schemeEnd = rawUrl.indexOf("://");
  if (schemeEnd === -1) return rawUrl;

  const qIdx = rawUrl.indexOf("?");
  const query = qIdx === -1 ? "" : rawUrl.slice(qIdx);
  const base = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);

  const afterScheme = base.slice(schemeEnd + 3);
  const slashIdx = afterScheme.indexOf("/");
  const hostPart = slashIdx === -1 ? afterScheme : afterScheme.slice(0, slashIdx);
  const existingDb = slashIdx === -1 ? "" : afterScheme.slice(slashIdx + 1);

  const db = existingDb && existingDb.length > 0 ? existingDb : dbName || "";
  const scheme = base.slice(0, schemeEnd + 3);
  return `${scheme}${hostPart}/${db}${query}`;
}

// Merge env files without clobbering anything already in the real process env.
const fromBackend = parseEnvFile("/app/backend/.env");
const fromRoot = parseEnvFile("/app/.env");
for (const [k, v] of Object.entries({ ...fromRoot, ...fromBackend })) {
  if (process.env[k] === undefined) process.env[k] = v;
}

// Prisma needs the db name inside the connection string.
if (process.env.MONGO_URL) {
  process.env.MONGO_URL = withDatabase(
    process.env.MONGO_URL,
    process.env.DB_NAME
  );
}

function startNext() {
  const child = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"],
    { cwd: "/app", stdio: "inherit", env: process.env }
  );
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
}

function runScript(relPath) {
  return new Promise((resolve) => {
    const p = spawn("node", ["node_modules/.bin/tsx", relPath], {
      cwd: "/app",
      stdio: "inherit",
      env: process.env,
    });
    p.on("exit", (code) => resolve(code ?? 0));
    p.on("error", () => resolve(1));
  });
}

/**
 * On a fresh production database (e.g. the first deploy against managed Atlas),
 * the collections are empty so login would have no accounts. Seed the master
 * register + real team ONCE when there are zero users. No-op everywhere that is
 * already seeded (preview, subsequent boots).
 */
async function ensureSeed() {
  if (!process.env.MONGO_URL) return;
  let prisma;
  try {
    const { PrismaClient } = require("@prisma/client");
    prisma = new PrismaClient();
    const count = await prisma.user.count();
    if (count > 0) return;
    console.log("[bootstrap] Empty database — seeding master data + team…");
    await runScript("prisma/seed.ts");
    await runScript("prisma/import-team.ts");
    console.log("[bootstrap] Seed complete.");
  } catch (e) {
    console.error("[bootstrap] Seed check failed (continuing to start):", e?.message || e);
  } finally {
    if (prisma) await prisma.$disconnect().catch(() => {});
  }
}

ensureSeed().finally(startNext);
