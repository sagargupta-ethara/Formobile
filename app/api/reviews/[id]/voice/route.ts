import { prisma } from "@/lib/db";
import { ApiError, fail, requireUser } from "@/lib/api";
import { contentType, readFile } from "@/lib/storage";
import { onsiteIsRouted } from "@/lib/access";

// GET /api/reviews/:id/voice — stream a rejection voice memo.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            designerId: true,
            category: { select: { specializationId: true } },
          },
        },
      },
    });
    if (!review?.voiceNoteKey) throw new ApiError(404, "Voice note not found");

    const { task } = review;
    if (user.role === "DESIGNER" && task.designerId !== user.id)
      throw new ApiError(403, "Forbidden");
    if (user.role === "ONSITE" && !onsiteIsRouted(user, task.category))
      throw new ApiError(403, "Forbidden");

    const data = await readFile(review.voiceNoteKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType(review.voiceNoteType ?? "webm"),
        "Content-Length": String(data.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
