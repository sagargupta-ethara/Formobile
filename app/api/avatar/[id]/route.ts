import { prisma } from "@/lib/db";
import { ApiError, fail, requireUser } from "@/lib/api";
import { contentType, extOf, readFile } from "@/lib/storage";

// GET /api/avatar/:id — stream a user's profile photo (any signed-in user).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { avatarKey: true },
    });
    if (!user?.avatarKey) throw new ApiError(404, "No avatar");

    const data = await readFile(user.avatarKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType(extOf(user.avatarKey)),
        "Content-Length": String(data.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
