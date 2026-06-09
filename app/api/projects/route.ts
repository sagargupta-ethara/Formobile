import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  clientName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  expectedCompletion: z.string().optional().nullable(),
  status: z
    .enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"])
    .optional(),
  floors: z.array(z.string()).optional(),
});

export async function GET() {
  try {
    await requireUser();
    const projects = await prisma.project.findMany({
      include: {
        _count: { select: { floors: true, tasks: true } },
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
                .filter((f) => f.trim())
                .map((floorName, i) => ({ floorName: floorName.trim(), order: i })),
            }
          : undefined,
      },
      include: { _count: { select: { floors: true, tasks: true } } },
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
