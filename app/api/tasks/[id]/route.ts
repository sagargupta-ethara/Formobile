import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { onsiteIsRouted, visibleFiles } from "@/lib/access";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fmtDateTime } from "@/lib/format";

// GET /api/tasks/:id — full task detail, with role-based file visibility.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const task = await prisma.designTask.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, floorName: true } },
        category: {
          select: { id: true, name: true, specializationId: true },
        },
        designer: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true, email: true } },
        assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
        files: {
          orderBy: { version: "desc" },
          include: { uploadedBy: { select: { name: true } } },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            reviewer: { select: { name: true } },
            photos: { select: { id: true, fileName: true } },
          },
        },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");

    // Authorization per role (assignees and assigned reviewer always have access)
    const isAssignee =
      task.designerId === user.id ||
      task.assignees.some((a) => a.user.id === user.id);
    const isReviewer = task.reviewerId === user.id;
    if (user.role === "DESIGNER" && !isAssignee) {
      throw new ApiError(403, "This task is not assigned to you");
    }
    if (user.role === "ONSITE" && !isAssignee && !isReviewer) {
      if (task.reviewerId)
        throw new ApiError(403, "This review is assigned to another off-site member");
      if (!onsiteIsRouted(user, task.category))
        throw new ApiError(403, "This design is routed to a different team");
    }

    // Enforce version visibility: on-site reviewers never see superseded /
    // rejected versions — only the current one while it is under review.
    const files = isAssignee ? task.files : visibleFiles(user, task, task.files);

    // On-site reviewers also shouldn't see other reviewers' comment history of
    // older versions clutter; keep it simple and show all decisions (the audit
    // trail), but only expose current-version files.
    return json({ task: { ...task, files } });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  designerId: z.string().min(1).optional(),
  designerIds: z.array(z.string().min(1)).min(1).optional(),
  reviewerId: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
});

// PATCH /api/tasks/:id — admin modifies an assigned task.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const data = patchSchema.parse(await req.json());

    const task = await prisma.designTask.findUnique({
      where: { id },
      include: {
        category: { select: { name: true } },
        floor: { select: { floorName: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");

    const newAssignees = data.designerIds
      ? [...new Set(data.designerIds)]
      : data.designerId
      ? [data.designerId]
      : null;
    if (newAssignees) {
      const users = await prisma.user.findMany({ where: { id: { in: newAssignees } } });
      if (
        users.length !== newAssignees.length ||
        users.some((u) => u.role === "ADMIN" || u.status !== "ACTIVE")
      )
        throw new ApiError(400, "Tasks can be assigned to any active team member except admins");
      for (const userId of newAssignees) {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId: task.projectId, userId } },
          update: {},
          create: { projectId: task.projectId, userId },
        });
      }
      // replace the assignee set
      await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      await prisma.taskAssignee.createMany({
        data: newAssignees.map((userId) => ({ taskId: id, userId })),
      });
    }
    if (data.reviewerId) {
      const reviewer = await prisma.user.findUnique({ where: { id: data.reviewerId } });
      if (!reviewer || reviewer.role !== "ONSITE" || reviewer.status !== "ACTIVE")
        throw new ApiError(400, "The reviewer must be an active on-site team member");
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId: task.projectId, userId: data.reviewerId },
        },
        update: {},
        create: { projectId: task.projectId, userId: data.reviewerId },
      });
    }

    const updated = await prisma.designTask.update({
      where: { id },
      data: {
        designerId: newAssignees ? newAssignees[0] : undefined,
        reviewerId: data.reviewerId === undefined ? undefined : data.reviewerId || null,
        deadline:
          data.deadline === undefined
            ? undefined
            : data.deadline
            ? new Date(data.deadline)
            : null,
        // a fresh deadline clears any earlier deadline alert
        deadlineNotifiedAt: data.deadline !== undefined ? null : undefined,
      },
    });

    await audit({
      entityType: "DesignTask",
      entityId: id,
      action: "TASK_UPDATED",
      detail: [
        newAssignees ? "reassigned" : null,
        data.deadline !== undefined ? "deadline changed" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      performedById: admin.id,
    });
    if (newAssignees) {
      const fresh = newAssignees.filter((uid) => uid !== task.designerId);
      await notify(fresh, {
        type: "ASSIGNED",
        title: `Task assigned — ${task.category.name}`,
        body: `${task.project.name} · ${task.floor.floorName}${
          updated.deadline ? ` · due ${fmtDateTime(updated.deadline)}` : ""
        }`,
        link: `/tasks/${id}`,
      });
    }
    if (data.reviewerId && data.reviewerId !== task.reviewerId) {
      await notify([data.reviewerId], {
        type: "ASSIGNED",
        title: `You will review — ${task.category.name}`,
        body: `${task.project.name} · ${task.floor.floorName}. 24h to decide once uploaded.`,
        link: `/tasks/${id}`,
      });
    }
    return json({ task: updated });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: "Invalid input" }, 400);
    return fail(e);
  }
}

// DELETE /api/tasks/:id — admin removes a task (files/reviews cascade).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const task = await prisma.designTask.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });
    if (!task) throw new ApiError(404, "Task not found");
    await prisma.designTask.delete({ where: { id } });
    await audit({
      entityType: "DesignTask",
      entityId: id,
      action: "TASK_DELETED",
      detail: task.category.name,
      performedById: admin.id,
    });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
