import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { ApiError, fail, json } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = schema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) throw new ApiError(401, "Invalid email or password");
    if (user.status !== "ACTIVE")
      throw new ApiError(403, "Your account is inactive. Contact an admin.");

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new ApiError(401, "Invalid email or password");

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      specializationId: user.specializationId,
      isSuperAdmin: user.isSuperAdmin,
    };
    const token = await createSession(sessionUser);
    // `token` is also returned so non-browser clients (the mobile app) can store
    // it and send it as `Authorization: Bearer <token>`. Web ignores it and uses
    // the httpOnly cookie set by createSession().
    return json({ user: sessionUser, token });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Email and password are required" }, 400);
    return fail(e);
  }
}
