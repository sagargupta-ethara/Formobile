import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        floors: { orderBy: { order: "asc" } },
      },
    });
    if (!project) throw new ApiError(404, "Project not found");
    return json({ project });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  clientName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  expectedCompletion: z.string().optional().nullable(),
  status: z
    .enum(["PLANNING", "ACTIVE", "ON_HOLD", "UPCOMING", "COMPLETED"])
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const data = patchSchema.parse(await req.json());
    if (data.code) {
      const clash = await prisma.project.findUnique({ where: { code: data.code.trim() } });
      if (clash && clash.id !== id)
        return json({ error: "Another project already uses this code" }, 409);
    }
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code?.trim(),
        clientName: data.clientName,
        location: data.location,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        expectedCompletion: data.expectedCompletion
          ? new Date(data.expectedCompletion)
          : undefined,
        status: data.status,
      },
    });
    await audit({
      entityType: "Project",
      entityId: id,
      action: "PROJECT_UPDATED",
      performedById: admin.id,
    });
    return json({ project });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Invalid input" }, 400);
    return fail(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    await audit({
      entityType: "Project",
      entityId: id,
      action: "PROJECT_DELETED",
      performedById: admin.id,
    });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
