import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { onsiteIsRouted } from "@/lib/access";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comments: z.string().optional().nullable(),
});

// POST /api/tasks/:id/reviews — on-site employee approves or rejects.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "ONSITE")
      throw new ApiError(403, "Only on-site reviewers can approve or reject");

    const { id } = await params;
    const data = schema.parse(await req.json());

    const task = await prisma.designTask.findUnique({
      where: { id },
      include: { category: { select: { specializationId: true } } },
    });
    if (!task) throw new ApiError(404, "Task not found");
    if (!onsiteIsRouted(user, task.category))
      throw new ApiError(403, "This design is routed to a different team");
    if (task.status !== "PENDING_REVIEW" && task.status !== "REVISION_SUBMITTED")
      throw new ApiError(409, "There is no design pending your review");

    // Rejection requires a written reason (voice memo support is Phase 2).
    if (data.decision === "REJECTED" && !data.comments?.trim())
      throw new ApiError(400, "A reason is required when rejecting a design");

    await prisma.$transaction([
      prisma.review.create({
        data: {
          taskId: id,
          reviewerId: user.id,
          version: task.currentVersion,
          decision: data.decision,
          comments: data.comments?.trim() || null,
        },
      }),
      prisma.designTask.update({
        where: { id },
        data: {
          status: data.decision === "APPROVED" ? "APPROVED" : "REJECTED",
          reviewDueAt: null,
        },
      }),
    ]);

    await audit({
      entityType: "DesignTask",
      entityId: id,
      action: data.decision === "APPROVED" ? "DESIGN_APPROVED" : "DESIGN_REJECTED",
      detail: `v${task.currentVersion}${
        data.comments ? ` · ${data.comments.trim().slice(0, 120)}` : ""
      }`,
      performedById: user.id,
    });

    return json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: e.errors[0]?.message ?? "Invalid input" }, 400);
    return fail(e);
  }
}
