import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { fail, json, requireRole } from "@/lib/api";
import { audit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  specializationId: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const data = patchSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        status: data.status,
        specializationId:
          data.specializationId === undefined
            ? undefined
            : data.specializationId || null,
        passwordHash: data.password
          ? await hashPassword(data.password)
          : undefined,
      },
      select: { id: true, name: true, status: true },
    });
    await audit({
      entityType: "User",
      entityId: id,
      action: "USER_UPDATED",
      performedById: admin.id,
    });
    return json({ user });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
