import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireRole, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// GET /api/projects/:id/members — the project's team.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            status: true,
            specialization: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return json({ members });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/projects/:id/members — add someone to the project team.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const { userId } = z.object({ userId: z.string().min(1) }).parse(await req.json());

    const [project, user] = await Promise.all([
      prisma.project.findUnique({ where: { id }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (!project) throw new ApiError(404, "Project not found");
    if (!user) throw new ApiError(404, "User not found");

    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId } },
      update: {},
      create: { projectId: id, userId },
    });
    await audit({
      entityType: "Project",
      entityId: id,
      action: "MEMBER_ADDED",
      detail: user.name,
      performedById: admin.id,
    });
    await notify([userId], {
      type: "ASSIGNED",
      title: `Added to project — ${project.name}`,
      body: "You are now part of this project's team.",
      link: `/projects/${id}`,
    });
    return json({ member }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: "User is required" }, 400);
    return fail(e);
  }
}

// DELETE /api/projects/:id/members?userId=… — remove from the team.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole("ADMIN");
    const { id } = await params;
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) throw new ApiError(400, "userId is required");
    await prisma.projectMember.deleteMany({ where: { projectId: id, userId } });
    await audit({
      entityType: "Project",
      entityId: id,
      action: "MEMBER_REMOVED",
      detail: userId,
      performedById: admin.id,
    });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
