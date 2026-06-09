import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, json, requireRole, requireUser } from "@/lib/api";

export async function GET() {
  try {
    await requireUser();
    const categories = await prisma.designCategory.findMany({
      include: { specialization: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return json({ categories });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const { name, specializationId } = z
      .object({
        name: z.string().min(1),
        specializationId: z.string().optional().nullable(),
      })
      .parse(await req.json());
    const category = await prisma.designCategory.create({
      data: { name: name.trim(), specializationId: specializationId || null },
    });
    return json({ category }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Name is required" }, 400);
    return fail(e);
  }
}
