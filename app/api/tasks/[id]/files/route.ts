import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { ALLOWED_EXT, MAX_FILE_BYTES, extOf, saveFile } from "@/lib/storage";

const REVIEW_SLA_HOURS = 24;

// POST /api/tasks/:id/files — designer uploads a new design version.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    if (user.role !== "DESIGNER" && user.role !== "ADMIN")
      throw new ApiError(403, "Only designers can upload designs");

    const { id } = await params;
    const task = await prisma.designTask.findUnique({ where: { id } });
    if (!task) throw new ApiError(404, "Task not found");
    if (user.role === "DESIGNER" && task.designerId !== user.id)
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

    return json({ file: created, version: nextVersion }, 201);
  } catch (e) {
    return fail(e);
  }
}
