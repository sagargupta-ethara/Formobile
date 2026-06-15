import "server-only";
import { prisma } from "./db";

/**
 * Give a project its own editable copy of the master drawing register
 * (DesignCategory rows with projectId = null). Skips names the project
 * already has, so it is safe to call more than once.
 */
export async function copyTemplateRegister(projectId: string): Promise<number> {
  const [template, existing] = await Promise.all([
    prisma.designCategory.findMany({ where: { projectId: null } }),
    prisma.designCategory.findMany({
      where: { projectId },
      select: { name: true },
    }),
  ]);
  const have = new Set(existing.map((c) => c.name));
  const missing = template.filter((t) => !have.has(t.name));
  if (missing.length === 0) return 0;
  await prisma.designCategory.createMany({
    data: missing.map((t) => ({
      name: t.name,
      projectId,
      specializationId: t.specializationId,
      appliesTo: t.appliesTo,
      discipline: t.discipline,
    })),
  });
  return missing.length;
}
