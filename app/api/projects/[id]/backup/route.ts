import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { requireRole, fail } from "@/lib/api";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

// GET /api/projects/:id/backup — admin downloads a ZIP of every uploaded
// drawing file for the project (all versions), organised by floor and drawing.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("ADMIN");
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!project) return fail(new Error("Project not found"));

    const tasks = await prisma.designTask.findMany({
      where: { projectId: id },
      select: {
        floor: { select: { floorName: true, order: true } },
        category: { select: { name: true } },
        files: {
          select: { version: true, fileName: true, storageKey: true },
          orderBy: { version: "asc" },
        },
      },
    });

    const zip = new JSZip();
    const seen = new Set<string>();
    let count = 0;
    for (const t of tasks) {
      for (const f of t.files) {
        try {
          const bytes = await readFile(f.storageKey);
          const floor = safe(t.floor.floorName);
          const drawing = safe(t.category.name);
          let entry = `${floor}/${drawing}/v${f.version}-${safe(f.fileName)}`;
          while (seen.has(entry)) entry = entry.replace(/(\.[^.]+)?$/, `-${count}$1`);
          seen.add(entry);
          zip.file(entry, bytes);
          count++;
        } catch {
          // a missing/unreadable file shouldn't abort the whole backup
        }
      }
    }

    if (count === 0) {
      zip.file(
        "README.txt",
        `No drawing files have been uploaded for "${project.name}" yet.`
      );
    }

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const fileName = `${safe(project.name)}-drawings-${stamp}.zip`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

function safe(name: string): string {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").trim() || "untitled";
}
