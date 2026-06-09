import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";

const listInclude = {
  project: { select: { id: true, name: true, code: true } },
  floor: { select: { id: true, floorName: true } },
  category: {
    select: { id: true, name: true, specializationId: true },
  },
  designer: { select: { id: true, name: true } },
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
      where.designerId = user.id;
    } else if (user.role === "ONSITE") {
      // routed by specialization: matching category, or categories with none
      where.category = {
        OR: [
          { specializationId: null },
          ...(user.specializationId
            ? [{ specializationId: user.specializationId }]
            : []),
        ],
      };
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
  designerId: z.string().min(1),
  deadline: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

// POST /api/tasks — admin assigns a design task (the assignment engine)
export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const data = createSchema.parse(await req.json());

    const floor = await prisma.floor.findUnique({
      where: { id: data.floorId },
    });
    if (!floor || floor.projectId !== data.projectId)
      throw new ApiError(400, "Floor does not belong to the selected project");

    const task = await prisma.designTask.create({
      data: {
        projectId: data.projectId,
        floorId: data.floorId,
        categoryId: data.categoryId,
        designerId: data.designerId,
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
    return json({ task }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
