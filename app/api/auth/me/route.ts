import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json } from "@/lib/api";

// GET /api/auth/me — current session + fresh user data (role/specialization
// can change between login and now, so we re-read from the DB).
export async function GET() {
  const session = await getSession();
  if (!session) return json({ user: null });
  const fresh = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      specializationId: true,
      specialization: { select: { id: true, name: true } },
    },
  });
  if (!fresh || fresh.status !== "ACTIVE") return json({ user: null });
  return json({ user: fresh });
}
