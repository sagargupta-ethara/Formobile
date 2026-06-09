import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";

// GET /api/profile — the signed-in user's own profile.
export async function GET() {
  try {
    const session = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        avatarKey: true,
        updatedAt: true,
        createdAt: true,
        specialization: { select: { id: true, name: true } },
      },
    });
    if (!user) throw new ApiError(404, "User not found");
    return json({
      user: {
        ...user,
        avatarKey: undefined,
        avatarUrl: user.avatarKey
          ? `/api/avatar/${user.id}?v=${user.updatedAt.getTime()}`
          : null,
      },
    });
  } catch (e) {
    return fail(e);
  }
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

// PATCH /api/profile — update own name/phone/password.
export async function PATCH(req: Request) {
  try {
    const session = await requireUser();
    const data = patchSchema.parse(await req.json());

    let passwordHash: string | undefined;
    if (data.newPassword) {
      const me = await prisma.user.findUnique({ where: { id: session.id } });
      if (!me) throw new ApiError(404, "User not found");
      const ok = await verifyPassword(data.currentPassword ?? "", me.passwordHash);
      if (!ok) throw new ApiError(400, "Current password is incorrect");
      passwordHash = await hashPassword(data.newPassword);
    }

    await prisma.user.update({
      where: { id: session.id },
      data: { name: data.name, phone: data.phone, passwordHash },
    });
    await audit({
      entityType: "User",
      entityId: session.id,
      action: "PROFILE_UPDATED",
      performedById: session.id,
    });
    return json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
