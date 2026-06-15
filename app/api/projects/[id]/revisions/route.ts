import { prisma } from "@/lib/db";
import { fail, json, requireRole } from "@/lib/api";

// GET /api/projects/:id/revisions — the project's review & revision history:
// every upload, approval and rejection, newest first. Feeds the Revisions tab.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    const [reviews, uploads] = await Promise.all([
      prisma.review.findMany({
        where: { task: { projectId: id } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          reviewer: { select: { name: true } },
          photos: { select: { id: true } },
          task: {
            select: {
              id: true,
              status: true,
              category: { select: { name: true } },
              floor: { select: { floorName: true } },
              designer: { select: { name: true } },
            },
          },
        },
      }),
      prisma.designFile.findMany({
        where: { task: { projectId: id } },
        orderBy: { uploadedAt: "desc" },
        take: 100,
        include: {
          uploadedBy: { select: { name: true } },
          task: {
            select: {
              id: true,
              status: true,
              category: { select: { name: true } },
              floor: { select: { floorName: true } },
            },
          },
        },
      }),
    ]);

    const events = [
      ...reviews.map((r) => ({
        id: `r-${r.id}`,
        kind: r.decision === "APPROVED" ? ("APPROVED" as const) : ("REJECTED" as const),
        taskId: r.task.id,
        drawing: r.task.category.name,
        floor: r.task.floor.floorName,
        version: r.version,
        by: r.reviewer?.name ?? "—",
        comments: r.comments,
        hasVoice: !!r.voiceNoteKey,
        photoCount: r.photos.length,
        at: r.createdAt,
      })),
      ...uploads.map((f) => ({
        id: `f-${f.id}`,
        kind: f.version > 1 ? ("REVISION" as const) : ("UPLOAD" as const),
        taskId: f.task.id,
        drawing: f.task.category.name,
        floor: f.task.floor.floorName,
        version: f.version,
        by: f.uploadedBy?.name ?? "—",
        comments: f.fileName,
        hasVoice: false,
        photoCount: 0,
        at: f.uploadedAt,
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

    return json({ events: events.slice(0, 120) });
  } catch (e) {
    return fail(e);
  }
}
