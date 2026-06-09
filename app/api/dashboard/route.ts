import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireUser();
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const PENDING: Prisma.EnumTaskStatusFilter = {
      in: ["PENDING_REVIEW", "REVISION_SUBMITTED"],
    };

    if (user.role === "ADMIN") {
      const [
        projects,
        pending,
        approved,
        rejected,
        overdue,
        todayDeadlines,
        designers,
        approvedTotal,
        reviewedTotal,
      ] = await Promise.all([
        prisma.project.count(),
        prisma.designTask.count({ where: { status: PENDING } }),
        prisma.designTask.count({ where: { status: "APPROVED" } }),
        prisma.designTask.count({ where: { status: "REJECTED" } }),
        prisma.designTask.count({
          where: { deadline: { lt: now }, status: { not: "APPROVED" } },
        }),
        prisma.designTask.count({
          where: { deadline: { gte: startOfDay, lte: endOfDay } },
        }),
        prisma.user.findMany({
          where: { role: "DESIGNER" },
          select: {
            id: true,
            name: true,
            _count: { select: { designTasks: true } },
          },
        }),
        prisma.designTask.count({ where: { status: "APPROVED" } }),
        prisma.review.count(),
      ]);

      // per-designer approval performance
      const designerPerf = await Promise.all(
        designers.map(async (d) => {
          const [approvedCount, total] = await Promise.all([
            prisma.designTask.count({
              where: { designerId: d.id, status: "APPROVED" },
            }),
            d._count.designTasks,
          ]);
          return { name: d.name, approved: approvedCount, total };
        })
      );

      const approvalRate =
        reviewedTotal > 0
          ? Math.round((approvedTotal / reviewedTotal) * 100)
          : 0;

      return json({
        role: "ADMIN",
        cards: { projects, pending, approved, rejected, overdue, todayDeadlines },
        charts: { approvalRate, designerPerf },
      });
    }

    if (user.role === "DESIGNER") {
      const base = { designerId: user.id };
      const [assigned, submitted, approved, rejected, overdue] =
        await Promise.all([
          prisma.designTask.count({ where: { ...base, status: "ASSIGNED" } }),
          prisma.designTask.count({ where: { ...base, status: PENDING } }),
          prisma.designTask.count({ where: { ...base, status: "APPROVED" } }),
          prisma.designTask.count({ where: { ...base, status: "REJECTED" } }),
          prisma.designTask.count({
            where: { ...base, deadline: { lt: now }, status: { not: "APPROVED" } },
          }),
        ]);
      return json({
        role: "DESIGNER",
        cards: { assigned, submitted, approved, rejected, overdue },
      });
    }

    // ONSITE
    const routed: Prisma.DesignTaskWhereInput = {
      category: {
        OR: [
          { specializationId: null },
          ...(user.specializationId
            ? [{ specializationId: user.specializationId }]
            : []),
        ],
      },
    };
    const [pendingReviews, approvals, rejections, expired] = await Promise.all([
      prisma.designTask.count({ where: { ...routed, status: PENDING } }),
      prisma.review.count({
        where: { reviewerId: user.id, decision: "APPROVED" },
      }),
      prisma.review.count({
        where: { reviewerId: user.id, decision: "REJECTED" },
      }),
      prisma.designTask.count({
        where: { ...routed, status: PENDING, reviewDueAt: { lt: now } },
      }),
    ]);
    return json({
      role: "ONSITE",
      cards: { pendingReviews, approvals, rejections, expired },
    });
  } catch (e) {
    return fail(e);
  }
}
