import { fail, json, requireRole } from "@/lib/api";
import { prisma } from "@/lib/db";
import { createBackup } from "@/lib/backup";

// GET /api/admin/backups — list backup metadata (admins only).
export async function GET() {
  try {
    await requireRole("ADMIN");
    const backups = await prisma.dbBackup.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        dateKey: true,
        trigger: true,
        status: true,
        filename: true,
        sizeBytes: true,
        stats: true,
        inDb: true,
        error: true,
        createdAt: true,
      },
    });
    return json({ backups });
  } catch (e) {
    return fail(e);
  }
}

// POST /api/admin/backups — run a backup now (admins only).
export async function POST() {
  try {
    await requireRole("ADMIN");
    const result = await createBackup("manual");
    return json({ ok: true, ...result });
  } catch (e) {
    return fail(e);
  }
}
