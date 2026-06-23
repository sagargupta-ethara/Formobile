import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole } from "@/lib/api";

// PATCH /api/categories/:id — edit a drawing type in a project register.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const data = z
      .object({
        name: z.string().min(1).optional(),
        specializationId: z.string().optional().nullable(),
        appliesTo: z
          .array(z.enum(["BASEMENT", "STILT", "FLOOR", "TERRACE"]))
          .optional(),
        floorIds: z.array(z.string()).optional(),
        discipline: z
          .enum(["INTERIOR", "STRUCTURE", "MEP", "WOODWORK"])
          .optional(),
      })
      .parse(await req.json());

    const cat = await prisma.designCategory.findUnique({ where: { id } });
    if (!cat) throw new ApiError(404, "Drawing type not found");
    if (data.name && data.name.trim() !== cat.name) {
      const clash = await prisma.designCategory.findFirst({
        where: { projectId: cat.projectId, name: data.name.trim(), id: { not: id } },
      });
      if (clash) throw new ApiError(409, "A drawing with that name already exists here");
    }

    const category = await prisma.designCategory.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        specializationId:
          data.specializationId === undefined
            ? undefined
            : data.specializationId || null,
        appliesTo: data.appliesTo,
        floorIds: data.floorIds,
        discipline: data.discipline,
      },
    });
    return json({ category });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: "Invalid input" }, 400);
    return fail(e);
  }
}

// DELETE /api/categories/:id — remove a drawing type (its tasks cascade).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const withTasks = await prisma.designCategory.findUnique({
      where: { id },
      include: { _count: { select: { tasks: true } } },
    });
    if (!withTasks) throw new ApiError(404, "Drawing type not found");
    if (withTasks._count.tasks > 0)
      throw new ApiError(
        409,
        `${withTasks._count.tasks} task(s) use this drawing — delete or reassign them first`
      );
    await prisma.designCategory.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
