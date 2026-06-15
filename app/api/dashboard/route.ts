import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, json, requireUser } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const projectId = new URL(req.url).searchParams.get("projectId") || undefined;
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const PENDING: Prisma.EnumTaskStatusFilter = {
      in: ["PENDING_REVIEW", "REVISION_SUBMITTED"],
    };

    if (user.role === "ADMIN") {
      // Admin analytics are project-scoped: pass ?projectId=… (the Analytics
      // tab). Without it, numbers span all projects.
      const scope = projectId ? { projectId } : {};
      const [
        total,
        assigned,
        pending,
        approved,
        rejected,
        overdue,
        todayDeadlines,
        reviewedTotal,
      ] = await Promise.all([
        prisma.designTask.count({ where: scope }),
        prisma.designTask.count({ where: { ...scope, status: "ASSIGNED" } }),
        prisma.designTask.count({ where: { ...scope, status: PENDING } }),
        prisma.designTask.count({ where: { ...scope, status: "APPROVED" } }),
        prisma.designTask.count({ where: { ...scope, status: "REJECTED" } }),
        prisma.designTask.count({
          where: { ...scope, deadline: { lt: now }, status: { not: "APPROVED" } },
        }),
        prisma.designTask.count({
          where: { ...scope, deadline: { gte: startOfDay, lte: endOfDay } },
        }),
        prisma.review.count({ where: projectId ? { task: { projectId } } : {} }),
      ]);

      // per-assignee performance within scope
      const grouped = await prisma.designTask.groupBy({
        by: ["designerId"],
        where: { ...scope, designerId: { not: null } },
        _count: { _all: true },
      });
      const approvedBy = await prisma.designTask.groupBy({
        by: ["designerId"],
        where: { ...scope, designerId: { not: null }, status: "APPROVED" },
        _count: { _all: true },
      });
      const userRows = await prisma.user.findMany({
        where: { id: { in: grouped.map((g) => g.designerId!).filter(Boolean) } },
        select: { id: true, name: true },
      });
      const nameOf = new Map(userRows.map((u) => [u.id, u.name]));
      const approvedOf = new Map(approvedBy.map((a) => [a.designerId, a._count._all]));
      const designerPerf = grouped
        .map((g) => ({
          name: nameOf.get(g.designerId!) ?? "—",
          approved: approvedOf.get(g.designerId) ?? 0,
          total: g._count._all,
        }))
        .sort((a, b) => b.total - a.total);

      const approvalRate =
        reviewedTotal > 0 ? Math.round((approved / reviewedTotal) * 100) : 0;

      // per-floor progress when scoped to a project
      let floorProgress: { id: string; name: string; approved: number; total: number }[] = [];
      if (projectId) {
        const floors = await prisma.floor.findMany({
          where: { projectId },
          orderBy: { order: "desc" },
          select: {
            id: true,
            floorName: true,
            _count: { select: { tasks: true } },
            tasks: { where: { status: "APPROVED" }, select: { id: true } },
          },
        });
        floorProgress = floors.map((f) => ({
          id: f.id,
          name: f.floorName,
          approved: f.tasks.length,
          total: f._count.tasks,
        }));
      }

      return json({
        role: "ADMIN",
        cards: { total, assigned, pending, approved, rejected, overdue, todayDeadlines },
        charts: { approvalRate, designerPerf, floorProgress },
      });
    }

    if (user.role === "DESIGNER") {
      const base = {
        OR: [
          { designerId: user.id },
          { assignees: { some: { userId: user.id } } },
        ],
      };
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

    // ONSITE — their dedicated review queue, plus (when no reviewer is set)
    // anything routed to their trade; generalists catch everything unrouted
    const routed: Prisma.DesignTaskWhereInput = {
      OR: [
        { reviewerId: user.id },
        {
          reviewerId: null,
          ...(user.specializationId
            ? {
                category: {
                  OR: [
                    { specializationId: null },
                    { specializationId: user.specializationId },
                  ],
                },
              }
            : {}),
        },
      ],
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
