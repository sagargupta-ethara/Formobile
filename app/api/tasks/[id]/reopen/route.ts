import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { onsiteIsRouted } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// POST /api/tasks/:id/reopen — the on-site reviewer who decided a drawing can
// undo an accidental approve/reject. It reopens the CURRENT version back to
// PENDING_REVIEW (with a fresh 24h SLA) so they can decide again.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ONSITE")
      throw new ApiError(403, "Only on-site reviewers can edit an outcome");

    const { id } = await params;
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
    if (task.reviewerId) {
      if (task.reviewerId !== user.id)
        throw new ApiError(403, "This review is assigned to another off-site member");
    } else if (!onsiteIsRouted(user, task.category)) {
      throw new ApiError(403, "This design is routed to a different team");
    }
    if (task.status !== "APPROVED" && task.status !== "REJECTED")
      throw new ApiError(409, "Only an approved or rejected drawing can be reopened");

    const due = new Date(Date.now() + 24 * 3600 * 1000);
    await prisma.designTask.update({
      where: { id },
      data: { status: "PENDING_REVIEW", reviewDueAt: due, escalatedAt: null },
    });

    await audit({
      entityType: "DesignTask",
      entityId: id,
      action: "REVIEW_REOPENED",
      detail: `v${task.currentVersion} outcome reopened for re-review`,
      performedById: user.id,
    });

    const assigneeIds = [
      ...new Set([task.designerId, ...task.assignees.map((a) => a.userId)]),
    ].filter(Boolean) as string[];
    if (assigneeIds.length) {
      await notify(assigneeIds, {
        type: "ASSIGNED",
        title: `Review reopened — ${task.category.name}`,
        body: `The reviewer is re-checking V${task.currentVersion} of ${task.category.name} · ${task.project.name} · ${task.floor.floorName}.`,
        link: `/tasks/${id}`,
      });
    }

    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
