import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { onsiteIsRouted } from "@/lib/access";
import { notify } from "@/lib/notify";
import {
  AUDIO_EXT,
  IMAGE_EXT,
  MAX_PHOTO_BYTES,
  MAX_REVIEW_PHOTOS,
  MAX_VOICE_BYTES,
  extOf,
  saveFile,
} from "@/lib/storage";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional().nullable(),
});

interface Media {
  voice: File | null;
  photos: File[];
}

async function parseBody(req: Request): Promise<{ data: z.infer<typeof schema>; media: Media }> {
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return { data: schema.parse(await req.json()), media: { voice: null, photos: [] } };
  }
  const form = await req.formData();
  const data = schema.parse({
    decision: form.get("decision"),
    comments: (form.get("comments") as string | null) ?? null,
  });
  const voice = form.get("voice");
  const photos = form.getAll("photos").filter((p): p is File => p instanceof File);
  return {
    data,
    media: { voice: voice instanceof File ? voice : null, photos },
  };
}

// POST /api/tasks/:id/reviews — on-site employee approves or rejects.
// Rejections carry a written reason and (per the PRD) a recorded voice memo
// plus optional site photos.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ONSITE")
      throw new ApiError(403, "Only on-site reviewers can approve or reject");

    const { id } = await params;
    const { data, media } = await parseBody(req);

    const task = await prisma.designTask.findUnique({
      where: { id },
      include: {
        category: { select: { name: true, specializationId: true } },
        floor: { select: { floorName: true } },
        project: { select: { name: true } },
        assignees: { select: { userId: true } },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");
    // a dedicated reviewer owns the decision; otherwise trade routing applies
    if (task.reviewerId) {
      if (task.reviewerId !== user.id)
        throw new ApiError(403, "This review is assigned to another off-site member");
    } else if (!onsiteIsRouted(user, task.category)) {
      throw new ApiError(403, "This design is routed to a different team");
    }
    if (task.status !== "PENDING_REVIEW" && task.status !== "REVISION_SUBMITTED")
      throw new ApiError(409, "There is no design pending your review");

    if (data.decision === "REJECTED" && !data.comments?.trim())
      throw new ApiError(400, "A reason is required when rejecting a design");

    // ---- validate media (rejections only) ----
    if (data.decision === "APPROVED" && (media.voice || media.photos.length))
      throw new ApiError(400, "Voice notes and photos accompany rejections only");
    if (media.voice) {
      const ext = extOf(media.voice.name);
      if (!AUDIO_EXT.has(ext))
        throw new ApiError(400, "Unsupported audio format. Use MP3, AAC, WAV or a browser recording");
      if (media.voice.size > MAX_VOICE_BYTES)
        throw new ApiError(400, "Voice memo is too large (max ~5 minutes)");
    }
    if (media.photos.length > MAX_REVIEW_PHOTOS)
      throw new ApiError(400, `At most ${MAX_REVIEW_PHOTOS} photos per review`);
    for (const p of media.photos) {
      if (!IMAGE_EXT.has(extOf(p.name)))
        throw new ApiError(400, "Photos must be PNG, JPG, WEBP or GIF");
      if (p.size > MAX_PHOTO_BYTES)
        throw new ApiError(400, "Each photo must be under 10 MB");
    }

    // ---- persist media to storage ----
    let voiceNoteKey: string | null = null;
    let voiceNoteType: string | null = null;
    if (media.voice) {
      voiceNoteKey = await saveFile(
        id,
        media.voice.name,
        Buffer.from(await media.voice.arrayBuffer())
      );
      voiceNoteType = extOf(media.voice.name);
    }
    const photoRows = await Promise.all(
      media.photos.map(async (p) => ({
        storageKey: await saveFile(id, p.name, Buffer.from(await p.arrayBuffer())),
        fileName: p.name,
        fileType: extOf(p.name),
        fileSize: p.size,
      }))
    );

    await prisma.$transaction([
      prisma.review.create({
        data: {
          taskId: id,
          reviewerId: user.id,
          version: task.currentVersion,
          decision: data.decision,
          comments: data.comments?.trim() || null,
          voiceNoteKey,
          voiceNoteType,
          photos: { create: photoRows },
        },
      }),
      prisma.designTask.update({
        where: { id },
        data: {
          status: data.decision === "APPROVED" ? "APPROVED" : "REJECTED",
          reviewDueAt: null,
          escalatedAt: null,
        },
      }),
    ]);

    const approved = data.decision === "APPROVED";
    await audit({
      entityType: "DesignTask",
      entityId: id,
      action: approved ? "DESIGN_APPROVED" : "DESIGN_REJECTED",
      detail: `v${task.currentVersion}${
        data.comments ? ` · ${data.comments.trim().slice(0, 120)}` : ""
      }${voiceNoteKey ? " · voice note" : ""}${
        photoRows.length ? ` · ${photoRows.length} photo(s)` : ""
      }`,
      performedById: user.id,
    });
    if (voiceNoteKey)
      await audit({
        entityType: "DesignTask",
        entityId: id,
        action: "VOICE_NOTE_ADDED",
        detail: `v${task.currentVersion}`,
        performedById: user.id,
      });

    const assigneeIds = [
      ...new Set([task.designerId, ...task.assignees.map((a) => a.userId)]),
    ].filter(Boolean) as string[];
    if (assigneeIds.length) {
      const where = `${task.category.name} · ${task.project.name} · ${task.floor.floorName}`;
      await notify(assigneeIds, {
        type: approved ? "APPROVED" : "REJECTED",
        title: approved
          ? `Design approved — ${task.category.name}`
          : `Design rejected — ${task.category.name}`,
        body: approved
          ? `V${task.currentVersion} of ${where} was approved.`
          : `V${task.currentVersion} of ${where} needs revision${
              voiceNoteKey ? " (voice note attached)" : ""
            }.`,
        link: `/tasks/${id}`,
      });
    }

    return json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
