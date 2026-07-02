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
    const manifest: string[] = [
      `Project backup — ${project.name}`,
      `Generated: ${new Date().toISOString()}`,
      `Structure: <Floor>/<Drawing>/v<revision>-<file>`,
      "",
    ];
    // group by floor (bottom-to-top) so the ZIP is a clean floor-wise backup
    const byFloor = new Map<string, { name: string; order: number; tasks: typeof tasks }>();
    for (const t of tasks) {
      const key = `${t.floor.order}|${t.floor.floorName}`;
      if (!byFloor.has(key))
        byFloor.set(key, { name: t.floor.floorName, order: t.floor.order, tasks: [] });
      byFloor.get(key)!.tasks.push(t);
    }
    const floorsSorted = [...byFloor.values()].sort((a, b) => a.order - b.order);

    for (const fl of floorsSorted) {
      const prefix = String(fl.order + 1).padStart(2, "0");
      const floorDir = `${prefix} - ${safe(fl.name)}`;
      manifest.push(`## ${fl.name}`);
      for (const t of fl.tasks) {
        const drawing = safe(t.category.name);
        if (t.files.length === 0) {
          manifest.push(`   • ${t.category.name} — no files uploaded yet`);
          continue;
        }
        manifest.push(
          `   • ${t.category.name} — ${t.files.length} revision${t.files.length === 1 ? "" : "s"}`
        );
        for (const f of t.files) {
          try {
            const bytes = await readFile(f.storageKey);
            let entry = `${floorDir}/${drawing}/v${f.version}-${safe(f.fileName)}`;
            while (seen.has(entry)) entry = entry.replace(/(\.[^.]+)?$/, `-${count}$1`);
            seen.add(entry);
            zip.file(entry, bytes);
            count++;
          } catch {
            manifest.push(`       (! v${f.version} ${f.fileName} could not be read)`);
          }
        }
      }
      manifest.push("");
    }
    zip.file("_MANIFEST.txt", manifest.join("\n"));

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
