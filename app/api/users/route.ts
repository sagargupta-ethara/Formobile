import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "DESIGNER", "ONSITE"]),
  department: z.string().optional().nullable(),
  specializationId: z.string().optional().nullable(),
  password: z.string().min(6),
});

// GET /api/users?assignable=1 | ?role=… — directories for pickers and the
// Team page. `assignable` = everyone who can receive a task (non-admins).
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sp = new URL(req.url).searchParams;
    const role = sp.get("role") || undefined;
    const assignable = sp.get("assignable") === "1";

    // Non-admins may only use this endpoint as a *picker directory*
    // (assignable=1 or an explicit role filter). The full team listing —
    // with email, phone, status — is admin-only.
    if (user.role !== "ADMIN") {
      if (!assignable && role !== "DESIGNER" && role !== "ONSITE") {
        throw new ApiError(403, "Forbidden");
      }
      const users = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          ...(assignable
            ? { role: { not: "ADMIN" as const } }
            : { role: role === "DESIGNER" || role === "ONSITE" ? role : undefined }),
        },
        select: { id: true, name: true, role: true, department: true, specializationId: true },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      });
      return json({ users });
    }

    const users = await prisma.user.findMany({
      where: assignable
        ? { status: "ACTIVE", role: { not: "ADMIN" } }
        : role
        ? { role: role as never }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        department: true,
        status: true,
        specialization: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: assignable
        ? [{ department: "asc" }, { name: "asc" }]
        : { createdAt: "desc" },
    });
    return json({ users });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole("ADMIN");
    const data = createSchema.parse(await req.json());

    const exists = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (exists) throw new ApiError(409, "A user with this email already exists");

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        phone: data.phone,
        role: data.role,
        department: data.department || null,
        specializationId: data.specializationId || null,
        passwordHash: await hashPassword(data.password),
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await audit({
      entityType: "User",
      entityId: user.id,
      action: "USER_CREATED",
      detail: `${user.name} (${user.role})`,
      performedById: admin.id,
    });
    return json({ user }, 201);
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
