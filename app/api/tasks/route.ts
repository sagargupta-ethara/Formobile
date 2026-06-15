import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { fmtDateTime } from "@/lib/format";

const listInclude = {
  project: { select: { id: true, name: true, code: true } },
  floor: { select: { id: true, floorName: true } },
  category: {
    select: { id: true, name: true, specializationId: true, discipline: true },
  },
  designer: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  assignees: { select: { user: { select: { id: true, name: true } } } },
  _count: { select: { files: true } },
} satisfies Prisma.DesignTaskInclude;

// GET /api/tasks  — role-scoped task list
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    const projectId = sp.get("projectId") || undefined;
    const status = sp.get("status") || undefined;

    let where: Prisma.DesignTaskWhereInput = {};

    if (user.role === "DESIGNER") {
      where.OR = [
        { designerId: user.id },
        { assignees: { some: { userId: user.id } } },
      ];
    } else if (user.role === "ONSITE") {
      // their own review queue + their own uploads + (when no dedicated
      // reviewer is set) anything routed to their trade / to generalists
      where.OR = [
        { reviewerId: user.id },
        { designerId: user.id },
        { assignees: { some: { userId: user.id } } },
        {
          reviewerId: null,
          ...(user.specializationId
            ? {
                category: {
                  OR: [
                    { specializationId: null },
                    { specializationId: user.specializationId },
                  ],
                },
              }
            : {}),
        },
      ];
    }

    if (projectId) where.projectId = projectId;
    if (status) where.status = status as never;

    const tasks = await prisma.designTask.findMany({
      where,
      include: listInclude,
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    });
    return json({ tasks });
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  projectId: z.string().min(1),
  floorId: z.string().min(1),
  categoryId: z.string().min(1),
  // one or more team members (possibly from different departments)
  designerIds: z.array(z.string().min(1)).min(1).optional(),
  designerId: z.string().min(1).optional(), // legacy single-assignee
  reviewerId: z.string().optional().nullable(),
  deadline: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

// POST /api/tasks — admin assigns a design task (the assignment engine)
export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const data = createSchema.parse(await req.json());

    const assigneeIds = [
      ...new Set(data.designerIds ?? (data.designerId ? [data.designerId] : [])),
    ];
    if (assigneeIds.length === 0)
      throw new ApiError(400, "Pick at least one team member to assign");

    const [floor, category, assignees, reviewer] = await Promise.all([
      prisma.floor.findUnique({ where: { id: data.floorId } }),
      prisma.designCategory.findUnique({ where: { id: data.categoryId } }),
      prisma.user.findMany({ where: { id: { in: assigneeIds } } }),
      data.reviewerId
        ? prisma.user.findUnique({ where: { id: data.reviewerId } })
        : Promise.resolve(null),
    ]);
    if (!floor || floor.projectId !== data.projectId)
      throw new ApiError(400, "Floor does not belong to the selected project");
    if (!category || (category.projectId && category.projectId !== data.projectId))
      throw new ApiError(400, "Drawing type does not belong to this project");
    if (
      assignees.length !== assigneeIds.length ||
      assignees.some((a) => a.role === "ADMIN" || a.status !== "ACTIVE")
    )
      throw new ApiError(400, "Tasks can be assigned to any active team member except admins");
    if (data.reviewerId && (!reviewer || reviewer.role !== "ONSITE" || reviewer.status !== "ACTIVE"))
      throw new ApiError(400, "The reviewer must be an active on-site team member");

    // assignees + reviewer join the project team automatically
    for (const userId of [...assigneeIds, data.reviewerId].filter(Boolean) as string[]) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: data.projectId, userId } },
        update: {},
        create: { projectId: data.projectId, userId },
      });
    }

    const task = await prisma.designTask.create({
      data: {
        projectId: data.projectId,
        floorId: data.floorId,
        categoryId: data.categoryId,
        designerId: assigneeIds[0],
        reviewerId: data.reviewerId || null,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        deadline: data.deadline ? new Date(data.deadline) : null,
        priority: data.priority ?? "MEDIUM",
        status: "ASSIGNED",
      },
      include: listInclude,
    });
    await audit({
      entityType: "DesignTask",
      entityId: task.id,
      action: "TASK_ASSIGNED",
      detail: `${task.category.name} · ${task.floor.floorName} → ${task.designer?.name}`,
      performedById: admin.id,
    });
    await notify(assigneeIds, {
      type: "ASSIGNED",
      title: `New task — ${task.category.name}`,
      body: `${task.project.name} · ${task.floor.floorName}${
        task.deadline ? ` · due ${fmtDateTime(task.deadline)}` : ""
      }`,
      link: `/tasks/${task.id}`,
    });
    if (task.reviewer) {
      await notify([task.reviewer.id], {
        type: "ASSIGNED",
        title: `You will review — ${task.category.name}`,
        body: `${task.project.name} · ${task.floor.floorName}. You'll have 24h to approve or reject once it's uploaded.`,
        link: `/tasks/${task.id}`,
      });
    }
    return json({ task }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
