import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notify, routedReviewerIds } from "@/lib/notify";
import { ALLOWED_EXT, MAX_FILE_BYTES, extOf, saveFile } from "@/lib/storage";

const REVIEW_SLA_HOURS = 24;

// POST /api/tasks/:id/files — designer uploads a new design version.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const task = await prisma.designTask.findUnique({
      where: { id },
      include: {
        category: { select: { name: true, specializationId: true } },
        project: { select: { name: true } },
        floor: { select: { floorName: true } },
        assignees: { select: { userId: true } },
      },
    });
    if (!task) throw new ApiError(404, "Task not found");
    // any assignee (any role) or an admin may upload
    const isAssignee =
      task.designerId === user.id ||
      task.assignees.some((a) => a.userId === user.id);
    if (user.role !== "ADMIN" && !isAssignee)
      throw new ApiError(403, "This task is not assigned to you");
    if (task.status === "APPROVED")
      throw new ApiError(409, "This design is already approved");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(400, "A file is required");

    const ext = extOf(file.name);
    if (!ALLOWED_EXT.has(ext))
      throw new ApiError(
        400,
        `Unsupported file type ".${ext}". Allowed: PDF, DWG, DXF, PNG, JPG, ZIP`
      );
    if (file.size > MAX_FILE_BYTES)
      throw new ApiError(400, "File exceeds the 50 MB limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    const storageKey = await saveFile(id, file.name, buffer);

    const nextVersion = task.currentVersion + 1;
    const wasRejected = task.status === "REJECTED";
    const dueAt = new Date(Date.now() + REVIEW_SLA_HOURS * 3600 * 1000);

    const [created] = await prisma.$transaction([
      prisma.designFile.create({
        data: {
          taskId: id,
          version: nextVersion,
          fileName: file.name,
          fileType: ext,
          fileSize: file.size,
          storageKey,
          uploadedById: user.id,
        },
      }),
      prisma.designTask.update({
        where: { id },
        data: {
          currentVersion: nextVersion,
          // First upload -> PENDING_REVIEW; an upload after rejection is a
          // revision. Either way it routes (back) to the on-site reviewer, and
          // the newly uploaded version becomes the only one they can see.
          status: wasRejected ? "REVISION_SUBMITTED" : "PENDING_REVIEW",
          reviewDueAt: dueAt,
        },
      }),
    ]);

    await audit({
      entityType: "DesignTask",
      entityId: id,
      action: wasRejected ? "REVISION_SUBMITTED" : "DESIGN_UPLOADED",
      detail: `v${nextVersion} · ${file.name}`,
      performedById: user.id,
    });

    // Route the design: to the dedicated reviewer if one is assigned,
    // otherwise broadcast to the matching on-site team (Module 7).
    const reviewers = task.reviewerId
      ? [task.reviewerId]
      : await routedReviewerIds(task.category.specializationId);
    await notify(reviewers, {
      type: wasRejected ? "REVISION" : "UPLOADED",
      title: wasRejected
        ? `Revision submitted — ${task.category.name}`
        : `Design ready for review — ${task.category.name}`,
      body: `${task.project.name} · ${task.floor.floorName} · V${nextVersion}. Review due within 24h.`,
      link: `/tasks/${id}`,
    });

    return json({ file: created, version: nextVersion }, 201);
  } catch (e) {
    return fail(e);
  }
}
