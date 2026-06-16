import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

/** Allowed upload extensions per the PRD (design files + voice notes). */
export const ALLOWED_EXT = new Set([
  // design files
  "pdf", "dwg", "dxf", "png", "jpg", "jpeg", "zip",
  // voice notes (reject memos)
  "mp3", "aac", "wav",
]);

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

/** Voice memo formats: PRD list + what browsers' MediaRecorder produces. */
export const AUDIO_EXT = new Set(["mp3", "aac", "wav", "webm", "m4a", "mp4", "ogg"]);
// 5 minutes of compressed audio fits comfortably under this.
export const MAX_VOICE_BYTES = 15 * 1024 * 1024;
export const MAX_REVIEW_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

// ---------------------------------------------------------------------------
// Emergent Object Storage backend
// ---------------------------------------------------------------------------
// When EMERGENT_LLM_KEY is present (production), files are persisted to the
// managed object store so they survive container restarts/scaling. Otherwise
// we fall back to local disk under STORAGE_DIR (preview / local dev).
// Storage keys for object-store files are prefixed with `${APP_PREFIX}/` which
// also lets readFile() route a key to the right backend (so legacy/seed files
// already on disk keep working).
const OBJSTORE_URL =
  "https://integrations.emergentagent.com/objstore/api/v1/storage";
const APP_PREFIX = "blueprint-flow";
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;
const useObjectStore = Boolean(EMERGENT_KEY);

let storageKeyPromise: Promise<string> | null = null;

async function initObjectStore(): Promise<string> {
  if (!storageKeyPromise) {
    storageKeyPromise = (async () => {
      const resp = await fetch(`${OBJSTORE_URL}/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergent_key: EMERGENT_KEY }),
      });
      if (!resp.ok) {
        storageKeyPromise = null; // allow retry on next call
        throw new Error(`Object storage init failed (${resp.status})`);
      }
      const data = (await resp.json()) as { storage_key: string };
      return data.storage_key;
    })();
  }
  return storageKeyPromise;
}

function isObjectKey(storageKey: string): boolean {
  return storageKey.startsWith(`${APP_PREFIX}/`);
}

async function putObject(
  objPath: string,
  data: Buffer,
  ct: string
): Promise<string> {
  const key = await initObjectStore();
  const resp = await fetch(`${OBJSTORE_URL}/objects/${objPath}`, {
    method: "PUT",
    headers: { "X-Storage-Key": key, "Content-Type": ct },
    body: new Uint8Array(data),
  });
  if (!resp.ok) throw new Error(`Object upload failed (${resp.status})`);
  const result = (await resp.json()) as { path?: string };
  return result.path ?? objPath;
}

async function getObject(objPath: string): Promise<Buffer> {
  const key = await initObjectStore();
  const resp = await fetch(`${OBJSTORE_URL}/objects/${objPath}`, {
    headers: { "X-Storage-Key": key },
  });
  if (!resp.ok) throw new Error(`Object download failed (${resp.status})`);
  return Buffer.from(await resp.arrayBuffer());
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ---------------------------------------------------------------------------
// Local disk backend
// ---------------------------------------------------------------------------
async function saveFileLocal(
  taskId: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  const dir = path.join(ROOT, "tasks", taskId);
  await fs.mkdir(dir, { recursive: true });
  const safe = `${crypto.randomBytes(8).toString("hex")}-${safeName(fileName)}`;
  const full = path.join(dir, safe);
  await fs.writeFile(full, data);
  return path.relative(ROOT, full);
}

async function readFileLocal(storageKey: string): Promise<Buffer> {
  const full = path.join(ROOT, storageKey);
  // prevent path traversal outside the storage root
  if (!path.resolve(full).startsWith(ROOT)) {
    throw new Error("Invalid storage key");
  }
  return fs.readFile(full);
}

// ---------------------------------------------------------------------------
// Public API (backend-agnostic)
// ---------------------------------------------------------------------------

/** Persist a design file, returning the storage key. */
export async function saveFile(
  taskId: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  if (useObjectStore) {
    const objPath = `${APP_PREFIX}/tasks/${taskId}/${crypto
      .randomBytes(8)
      .toString("hex")}-${safeName(fileName)}`;
    return putObject(objPath, data, contentType(extOf(fileName)));
  }
  return saveFileLocal(taskId, fileName, data);
}

/** Read a stored file by its storage key (object store or local disk). */
export async function readFile(storageKey: string): Promise<Buffer> {
  if (isObjectKey(storageKey)) return getObject(storageKey);
  return readFileLocal(storageKey);
}

export const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

/** Persist a profile photo, returning its storage key. */
export async function saveAvatar(
  userId: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  const ext = extOf(fileName) || "png";
  if (useObjectStore) {
    const objPath = `${APP_PREFIX}/avatars/${userId}-${crypto
      .randomBytes(6)
      .toString("hex")}.${ext}`;
    return putObject(objPath, data, contentType(ext));
  }
  const dir = path.join(ROOT, "avatars");
  await fs.mkdir(dir, { recursive: true });
  const full = path.join(dir, `${userId}-${crypto.randomBytes(6).toString("hex")}.${ext}`);
  await fs.writeFile(full, data);
  return path.relative(ROOT, full);
}

export function contentType(ext: string): string {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    zip: "application/zip",
    dwg: "application/acad",
    dxf: "image/vnd.dxf",
    mp3: "audio/mpeg",
    aac: "audio/aac",
    wav: "audio/wav",
    webm: "audio/webm",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    ogg: "audio/ogg",
  };
  return map[ext] ?? "application/octet-stream";
}
