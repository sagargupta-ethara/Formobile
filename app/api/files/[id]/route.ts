import { prisma } from "@/lib/db";
import { ApiError, fail, requireUser } from "@/lib/api";
import { contentType, readFile } from "@/lib/storage";
import { onsiteCanSeeVersion, onsiteIsRouted } from "@/lib/access";

// GET /api/files/:id — stream a stored design file with RBAC + version gating.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const file = await prisma.designFile.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            designerId: true,
            reviewerId: true,
            status: true,
            currentVersion: true,
            category: { select: { specializationId: true } },
            assignees: { select: { userId: true } },
          },
        },
      },
    });
    if (!file) throw new ApiError(404, "File not found");

    const { task } = file;
    const isAssignee =
      task.designerId === user.id ||
      task.assignees.some((a) => a.userId === user.id);
    if (user.role === "DESIGNER" && !isAssignee) {
      throw new ApiError(403, "Forbidden");
    }
    if (user.role === "ONSITE" && !isAssignee && task.reviewerId !== user.id) {
      // routing + the hide-superseded-versions rule, enforced at download time
      if (!onsiteIsRouted(user, task.category))
        throw new ApiError(403, "Forbidden");
      if (!onsiteCanSeeVersion(task, file.version))
        throw new ApiError(403, "This version is no longer available for review");
    }

    const data = await readFile(file.storageKey);
    const download = new URL(req.url).searchParams.get("download") === "1";
    const body = new Uint8Array(data);
    return new Response(body, {
      headers: {
        "Content-Type": contentType(file.fileType),
        "Content-Length": String(data.length),
        "Content-Disposition": `${
          download ? "attachment" : "inline"
        }; filename="${encodeURIComponent(file.fileName)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
