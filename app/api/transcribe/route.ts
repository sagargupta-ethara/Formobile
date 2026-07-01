import { fail, json, requireUser, ApiError } from "@/lib/api";

export const runtime = "nodejs";
const INTERNAL = "http://127.0.0.1:8001";

// POST /api/transcribe — transcribe a short voice note to text (Whisper).
// Authenticated here, then forwarded to the internal Python service that runs
// the transcription (Whisper is only available via the Python integration lib).
export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "No audio provided");
    if (file.size > 25 * 1024 * 1024)
      throw new ApiError(413, "Audio too large (max 25MB)");

    const fwd = await fetch(`${INTERNAL}/internal/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-audio-filename": file.name || "voice-note.webm",
      },
      body: Buffer.from(await file.arrayBuffer()),
    });
    if (!fwd.ok) {
      const detail = await fwd.text().catch(() => "");
      throw new ApiError(fwd.status === 503 ? 503 : 502, `Transcription failed${detail ? `: ${detail}` : ""}`);
    }
    const data = (await fwd.json()) as { text?: string };
    return json({ text: (data.text ?? "").trim() });
  } catch (e) {
    return fail(e);
  }
}
