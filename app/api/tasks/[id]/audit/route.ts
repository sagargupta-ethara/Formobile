import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { onsiteIsRouted } from "@/lib/access";

// GET /api/tasks/:id/audit — the immutable activity trail for a task
// (Module 12), visible to everyone who can open the task.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const task = await prisma.designTask.findUnique({
      where: { id },
      select: {
        designerId: true,
        category: { select: { specializationId: true } },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");
    if (user.role === "DESIGNER" && task.designerId !== user.id)
      throw new ApiError(403, "Forbidden");
    if (user.role === "ONSITE" && !onsiteIsRouted(user, task.category))
      throw new ApiError(403, "Forbidden");

    const logs = await prisma.auditLog.findMany({
      where: { entityType: "DesignTask", entityId: id },
      orderBy: { timestamp: "desc" },
      take: 50,
      include: { performedBy: { select: { name: true } } },
    });
    return json({ logs });
  } catch (e) {
    return fail(e);
  }
}
