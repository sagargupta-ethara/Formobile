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
    };
    await createSession(sessionUser);
    return json({ user: sessionUser });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Email and password are required" }, 400);
    return fail(e);
  }
}
