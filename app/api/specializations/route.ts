import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, json, requireRole, requireUser } from "@/lib/api";

export async function GET() {
  try {
    await requireUser();
    const specializations = await prisma.specialization.findMany({
      orderBy: { name: "asc" },
    });
    return json({ specializations });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireRole("ADMIN");
    const { name } = z
      .object({ name: z.string().min(1) })
      .parse(await req.json());
    const specialization = await prisma.specialization.create({
      data: { name: name.trim() },
    });
    return json({ specialization }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Name is required" }, 400);
    return fail(e);
  }
}
