import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole } from "@/lib/api";

// PATCH /api/specializations/:id — rename
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const { name } = z
      .object({ name: z.string().min(1) })
      .parse(await req.json());

    const existing = await prisma.specialization.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Specialization not found");

    const specialization = await prisma.specialization.update({
      where: { id },
      data: { name: name.trim() },
    });
    return json({ specialization });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Name is required" }, 400);
    return fail(e);
  }
}

// DELETE /api/specializations/:id — only allowed if no users/categories
// reference it (FK is SetNull, but deleting a spec in active use is
// disruptive enough that we make it explicit).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    const existing = await prisma.specialization.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Specialization not found");

    const [userCount, categoryCount] = await Promise.all([
      prisma.user.count({ where: { specializationId: id } }),
      prisma.designCategory.count({ where: { specializationId: id } }),
    ]);
    if (userCount + categoryCount > 0) {
      throw new ApiError(
        409,
        `In use by ${userCount} team member(s) and ${categoryCount} drawing type(s). Reassign them before deleting.`
      );
    }

    await prisma.specialization.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
