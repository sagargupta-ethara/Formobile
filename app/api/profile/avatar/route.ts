import { prisma } from "@/lib/db";
import { ApiError, fail, json, requireUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { IMAGE_EXT, MAX_AVATAR_BYTES, extOf, saveAvatar } from "@/lib/storage";

// POST /api/profile/avatar — upload/replace own profile photo.
export async function POST(req: Request) {
  try {
    const session = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "An image is required");

    const ext = extOf(file.name);
    if (!IMAGE_EXT.has(ext))
      throw new ApiError(400, "Please upload a PNG, JPG, WEBP or GIF image");
    if (file.size > MAX_AVATAR_BYTES)
      throw new ApiError(400, "Image exceeds the 5 MB limit");

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = await saveAvatar(session.id, file.name, buffer);
    const user = await prisma.user.update({
      where: { id: session.id },
      data: { avatarKey: key },
    });

    await audit({
      entityType: "User",
      entityId: session.id,
      action: "AVATAR_UPDATED",
      performedById: session.id,
    });
    return json({ avatarUrl: `/api/avatar/${user.id}?v=${user.updatedAt.getTime()}` });
  } catch (e) {
    return fail(e);
  }
}
