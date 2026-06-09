import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { onsiteIsRouted, visibleFiles } from "@/lib/access";

// GET /api/tasks/:id — full task detail, with role-based file visibility.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const task = await prisma.designTask.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, floorName: true } },
        category: {
          select: { id: true, name: true, specializationId: true },
        },
        designer: { select: { id: true, name: true, email: true } },
        files: {
          orderBy: { version: "desc" },
          include: { uploadedBy: { select: { name: true } } },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: { reviewer: { select: { name: true } } },
        },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");

    // Authorization per role
    if (user.role === "DESIGNER" && task.designerId !== user.id) {
      throw new ApiError(403, "This task is not assigned to you");
    }
    if (user.role === "ONSITE" && !onsiteIsRouted(user, task.category)) {
      throw new ApiError(403, "This design is routed to a different team");
    }

    // Enforce version visibility: on-site reviewers never see superseded /
    // rejected versions — only the current one while it is under review.
    const files = visibleFiles(user.role, task, task.files);

    // On-site reviewers also shouldn't see other reviewers' comment history of
    // older versions clutter; keep it simple and show all decisions (the audit
    // trail), but only expose current-version files.
    return json({ task: { ...task, files } });
  } catch (e) {
    return fail(e);
  }
}
