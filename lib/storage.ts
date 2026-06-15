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

/** Persist a file buffer to disk, returning the storage key (relative path). */
export async function saveFile(
  taskId: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  const dir = path.join(ROOT, "tasks", taskId);
  await fs.mkdir(dir, { recursive: true });
  const safe = `${crypto.randomBytes(8).toString("hex")}-${fileName.replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  )}`;
  const full = path.join(dir, safe);
  await fs.writeFile(full, data);
  return path.relative(ROOT, full);
}

/** Read a stored file by its storage key. */
export async function readFile(storageKey: string): Promise<Buffer> {
  const full = path.join(ROOT, storageKey);
  // prevent path traversal outside the storage root
  if (!path.resolve(full).startsWith(ROOT)) {
    throw new Error("Invalid storage key");
  }
  return fs.readFile(full);
}

export const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

/** Persist a profile photo, returning its storage key. */
export async function saveAvatar(
  userId: string,
  fileName: string,
  data: Buffer
): Promise<string> {
  const dir = path.join(ROOT, "avatars");
  await fs.mkdir(dir, { recursive: true });
  const ext = extOf(fileName) || "png";
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
