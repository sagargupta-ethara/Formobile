import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { copyTemplateRegister } from "@/lib/projectRegister";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  clientName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  expectedCompletion: z.string().optional().nullable(),
  status: z
    .enum(["PLANNING", "ACTIVE", "ON_HOLD", "UPCOMING", "COMPLETED"])
    .optional(),
  floors: z
    .array(
      z.union([
        z.string(),
        z.object({
          name: z.string().min(1),
          type: z.enum(["BASEMENT", "STILT", "FLOOR", "TERRACE"]).optional(),
        }),
      ])
    )
    .optional(),
});

export async function GET() {
  try {
    const user = await requireUser();

    // Role scoping: designers see projects they have tasks in; on-site
    // reviewers see projects with designs routed to their specialization;
    // admins see everything. Task counts are scoped the same way.
    let taskFilter: Prisma.DesignTaskWhereInput | undefined;
    let projectWhere: Prisma.ProjectWhereInput | undefined;
    if (user.role === "ONSITE") {
      // generalists (no specialization) see every project with reviewable work;
      // specialists see projects with work routed to them (per-task routing).
      taskFilter = user.specializationId
        ? {
            OR: [
              { specializationId: null },
              { specializationId: user.specializationId },
            ],
          }
        : {};
      projectWhere = { tasks: { some: taskFilter } };
    } else if (user.role === "DESIGNER") {
      // Designers only see projects they've been added to (project team).
      projectWhere = { members: { some: { userId: user.id } } };
    }
    // ADMIN sees everything.

    const projects = await prisma.project.findMany({
      where: projectWhere,
      include: {
        _count: {
          select: {
            floors: true,
            tasks: taskFilter ? { where: taskFilter } : true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return json({ projects });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const data = createSchema.parse(await req.json());

    const exists = await prisma.project.findUnique({
      where: { code: data.code.trim() },
    });
    if (exists) throw new ApiError(409, "A project with this code already exists");

    const project = await prisma.project.create({
      data: {
        name: data.name.trim(),
        code: data.code.trim(),
        clientName: data.clientName || null,
        location: data.location || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        expectedCompletion: data.expectedCompletion
          ? new Date(data.expectedCompletion)
          : null,
        status: data.status ?? "PLANNING",
        floors: data.floors?.length
          ? {
              create: data.floors
                .map((f) =>
                  typeof f === "string" ? { name: f, type: undefined } : f
                )
                .filter((f) => f.name.trim())
                .map((f, i) => ({
                  floorName: f.name.trim(),
                  floorType: f.type ?? "FLOOR",
                  order: i,
                })),
            }
          : undefined,
      },
      include: { _count: { select: { floors: true, tasks: true } } },
    });
    // every project starts with its own editable copy of the drawing register
    await copyTemplateRegister(project.id);
    // the creating admin is automatically on the project team
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: admin.id },
    });
    await audit({
      entityType: "Project",
      entityId: project.id,
      action: "PROJECT_CREATED",
      detail: project.name,
      performedById: admin.id,
    });
    return json({ project }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
