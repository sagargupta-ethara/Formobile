import { prisma } from "@/lib/db";
import { fail, json, requireRole } from "@/lib/api";

export const runtime = "nodejs";

// GET /api/projects/:id/archive — full, viewable backup tree for a project:
// floors (bottom-to-top) → drawings → every revision. Admin only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    const [project, floors, tasks] = await Promise.all([
      prisma.project.findUnique({
        where: { id },
        select: { id: true, name: true, code: true, status: true },
      }),
      prisma.floor.findMany({
        where: { projectId: id },
        select: { id: true, floorName: true, order: true },
        orderBy: { order: "asc" },
      }),
      prisma.designTask.findMany({
        where: { projectId: id },
        select: {
          id: true,
          floorId: true,
          status: true,
          category: { select: { name: true, discipline: true } },
          files: {
            select: { id: true, version: true, fileName: true, createdAt: true },
            orderBy: { version: "asc" },
          },
        },
      }),
    ]);
    if (!project) return fail(new Error("Project not found"));

    const floorTree = floors.map((f) => {
      const drawings = tasks
        .filter((t) => t.floorId === f.id)
        .map((t) => ({
          taskId: t.id,
          name: t.category.name,
          discipline: t.category.discipline,
          status: t.status,
          revisions: t.files.map((fl) => ({
            id: fl.id,
            version: fl.version,
            fileName: fl.fileName,
            createdAt: fl.createdAt,
            url: `/api/files/${fl.id}`,
          })),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        id: f.id,
        floorName: f.floorName,
        order: f.order,
        drawings,
        fileCount: drawings.reduce((n, d) => n + d.revisions.length, 0),
      };
    });

    const totalFiles = floorTree.reduce((n, f) => n + f.fileCount, 0);
    return json({ project, floors: floorTree, totalFiles });
  } catch (e) {
    return fail(e);
  }
}
