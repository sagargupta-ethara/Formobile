import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";

export const runtime = "nodejs";

// GET /api/projects/:id/uploads — every drawing that has at least one uploaded
// file, with all its versions. Visible to admins and to members of the project.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (user.role !== "ADMIN") {
      const member = await prisma.projectMember.findFirst({
        where: { projectId: id, userId: user.id },
      });
      if (!member)
        throw new ApiError(403, "You are not a member of this project");
    }

    const tasks = await prisma.designTask.findMany({
      where: { projectId: id, files: { some: {} } },
      select: {
        id: true,
        status: true,
        floor: { select: { floorName: true, order: true } },
        category: { select: { name: true, discipline: true } },
        files: {
          select: { id: true, version: true, fileName: true, fileType: true, uploadedAt: true },
          orderBy: { version: "desc" },
        },
      },
    });

    const drawings = tasks
      .map((t) => ({
        taskId: t.id,
        name: t.category.name,
        discipline: t.category.discipline,
        floorName: t.floor.floorName,
        floorOrder: t.floor.order,
        status: t.status,
        versions: t.files.map((f) => ({
          id: f.id,
          version: f.version,
          fileName: f.fileName,
          fileType: f.fileType,
          uploadedAt: f.uploadedAt,
          url: `/api/files/${f.id}`,
        })),
      }))
      .sort(
        (a, b) => a.floorOrder - b.floorOrder || a.name.localeCompare(b.name)
      );

    return json({ drawings });
  } catch (e) {
    return fail(e);
  }
}
