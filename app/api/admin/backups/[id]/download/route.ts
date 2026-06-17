import { ApiError, fail, requireRole } from "@/lib/api";
import { getBackupBytes } from "@/lib/backup";

// GET /api/admin/backups/[id]/download — stream the gzipped archive (admins only).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;
    const got = await getBackupBytes(id);
    if (!got) throw new ApiError(404, "Backup archive not found");
    return new Response(new Uint8Array(got.data), {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${got.filename}"`,
        "Content-Length": String(got.data.byteLength),
      },
    });
  } catch (e) {
    return fail(e);
  }
}
