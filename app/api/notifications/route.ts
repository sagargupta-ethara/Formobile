import { prisma } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { adminIds, notify, routedReviewerIds } from "@/lib/notify";

// Escalation engine (Module 13): any design still pending review past its SLA
// is escalated exactly once — admins and the routed team are notified and the
// breach is recorded in the audit trail. Runs lazily on the notification poll.
async function escalateOverdueReviews() {
  const overdue = await prisma.designTask.findMany({
    where: {
      status: { in: ["PENDING_REVIEW", "REVISION_SUBMITTED"] },
      reviewDueAt: { lt: new Date() },
      escalatedAt: null,
    },
    include: {
      category: { select: { name: true, specializationId: true } },
      project: { select: { name: true } },
      floor: { select: { floorName: true } },
    },
    take: 20,
  });
  if (overdue.length === 0) return;

  const admins = await adminIds();
  for (const t of overdue) {
    // claim atomically so concurrent polls don't double-notify
    const { count } = await prisma.designTask.updateMany({
      where: { id: t.id, escalatedAt: null },
      data: { escalatedAt: new Date() },
    });
    if (count === 0) continue;

    const where = `${t.category.name} · ${t.project.name} · ${t.floor.floorName}`;
    const reviewers = t.reviewerId
      ? [t.reviewerId]
      : await routedReviewerIds(t.category.specializationId);
    await notify([...admins, ...reviewers], {
      type: "REVIEW_OVERDUE",
      title: `Review overdue — ${t.category.name}`,
      body: `The 24h review window for ${where} has expired.`,
      link: `/tasks/${t.id}`,
    });
    await audit({
      entityType: "DesignTask",
      entityId: t.id,
      action: "REVIEW_OVERDUE",
      detail: `v${t.currentVersion} · SLA expired`,
    });
  }
}

// Deadline warnings (Module 11): alert the designer once when an unfinished
// task's deadline falls within the next 24 hours (or has just passed).
async function warnApproachingDeadlines() {
  const soon = new Date(Date.now() + 24 * 3600 * 1000);
  const tasks = await prisma.designTask.findMany({
    where: {
      status: { in: ["ASSIGNED", "REJECTED"] },
      designerId: { not: null },
      deadline: { lte: soon },
      deadlineNotifiedAt: null,
    },
    include: {
      category: { select: { name: true } },
      project: { select: { name: true } },
      floor: { select: { floorName: true } },
    },
    take: 20,
  });
  for (const t of tasks) {
    const { count } = await prisma.designTask.updateMany({
      where: { id: t.id, deadlineNotifiedAt: null },
      data: { deadlineNotifiedAt: new Date() },
    });
    if (count === 0 || !t.designerId || !t.deadline) continue;
    const overdue = t.deadline.getTime() < Date.now();
    await notify([t.designerId], {
      type: "DEADLINE",
      title: overdue
        ? `Deadline passed — ${t.category.name}`
        : `Deadline approaching — ${t.category.name}`,
      body: `${t.project.name} · ${t.floor.floorName} is due ${t.deadline.toLocaleString(
        "en-GB",
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      )}.`,
      link: `/tasks/${t.id}`,
    });
  }
}

// GET /api/notifications — latest feed + unread count for the bell.
export async function GET() {
  try {
    const user = await requireUser();
    await escalateOverdueReviews();
    await warnApproachingDeadlines();

    const [notifications, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);
    return json({ notifications, unread });
  } catch (e) {
    return fail(e);
  }
}

// PATCH /api/notifications — mark all (or one) as read.
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : undefined;
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
