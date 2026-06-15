import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const floors = await prisma.floor.findMany({
      where: { projectId: id },
      orderBy: { order: "asc" },
    });
    return json({ floors });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const { floorName, floorType } = z
      .object({
        floorName: z.string().min(1),
        floorType: z.enum(["BASEMENT", "STILT", "FLOOR", "TERRACE"]).optional(),
      })
      .parse(await req.json());
    const count = await prisma.floor.count({ where: { projectId: id } });
    const floor = await prisma.floor.create({
      data: {
        projectId: id,
        floorName: floorName.trim(),
        floorType: floorType ?? "FLOOR",
        order: count,
      },
    });
    return json({ floor }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Floor name is required" }, 400);
    return fail(e);
  }
}

// PATCH /api/projects/:id/floors — persist a new floor order (lowest elevation
// first). Admin only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const { orderedIds } = z
      .object({ orderedIds: z.array(z.string()).min(1) })
      .parse(await req.json());

    const floors = await prisma.floor.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    const ids = new Set(floors.map((f) => f.id));
    if (
      orderedIds.length !== floors.length ||
      orderedIds.some((x) => !ids.has(x))
    ) {
      throw new ApiError(400, "Floor list does not match this project");
    }

    await prisma.$transaction(
      orderedIds.map((fid, i) =>
        prisma.floor.update({ where: { id: fid }, data: { order: i } })
      )
    );
    return json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: "Invalid order" }, 400);
    return fail(e);
  }
}
