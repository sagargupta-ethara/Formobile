import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, json, requireRole } from "@/lib/api";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const { floorName } = z
      .object({ floorName: z.string().min(1) })
      .parse(await req.json());
    const floor = await prisma.floor.update({
      where: { id },
      data: { floorName: floorName.trim() },
    });
    return json({ floor });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Floor name is required" }, 400);
    return fail(e);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    await prisma.floor.delete({ where: { id } });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
