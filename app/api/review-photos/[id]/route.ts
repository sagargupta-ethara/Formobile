import { prisma } from "@/lib/db";
import { ApiError, fail, requireUser } from "@/lib/api";
import { contentType, readFile } from "@/lib/storage";
import { onsiteIsRouted } from "@/lib/access";

// GET /api/review-photos/:id — stream a site photo attached to a review.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const photo = await prisma.reviewPhoto.findUnique({
      where: { id },
      include: {
        review: {
          select: {
            task: {
              select: {
                designerId: true,
                category: { select: { specializationId: true } },
              },
            },
          },
        },
      },
    });
    if (!photo) throw new ApiError(404, "Photo not found");

    const { task } = photo.review;
    if (user.role === "DESIGNER" && task.designerId !== user.id)
      throw new ApiError(403, "Forbidden");
    if (user.role === "ONSITE" && !onsiteIsRouted(user, task.category))
      throw new ApiError(403, "Forbidden");

    const data = await readFile(photo.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType(photo.fileType),
        "Content-Length": String(data.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(photo.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
