import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, json, requireRole, requireUser } from "@/lib/api";

// GET /api/categories?projectId=… — a project's drawing register.
// Without projectId, returns the master template (used as the default set
// copied into each new project).
export async function GET(req: Request) {
  try {
    await requireUser();
    const projectId = new URL(req.url).searchParams.get("projectId");
    const categories = await prisma.designCategory.findMany({
      where: { projectId: projectId || null },
      include: { specialization: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return json({ categories });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/categories — add a drawing type to a project's register.
export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const { name, projectId, specializationId, appliesTo, discipline } = z
      .object({
        name: z.string().min(1),
        projectId: z.string().min(1),
        specializationId: z.string().optional().nullable(),
        appliesTo: z
          .array(z.enum(["BASEMENT", "STILT", "FLOOR", "TERRACE"]))
          .optional(),
        discipline: z
          .enum(["INTERIOR", "STRUCTURE", "MEP", "WOODWORK"])
          .optional(),
      })
      .parse(await req.json());
    const clash = await prisma.designCategory.findFirst({
      where: { projectId, name: name.trim() },
    });
    if (clash)
      return json({ error: "This project already has a drawing with that name" }, 409);
    const category = await prisma.designCategory.create({
      data: {
        name: name.trim(),
        projectId,
        specializationId: specializationId || null,
        appliesTo: appliesTo ?? [],
        discipline: discipline ?? "INTERIOR",
      },
    });
    return json({ category }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Name and project are required" }, 400);
    return fail(e);
  }
}
