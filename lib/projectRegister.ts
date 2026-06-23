import "server-only";
import { prisma } from "./db";

/** Floor ids a drawing applies to by default, derived from its `appliesTo`
 *  floor-type rule (empty rule = every floor). */
export function floorIdsForApplies(
  appliesTo: string[],
  floors: { id: string; floorType: string }[]
): string[] {
  return floors
    .filter((f) => appliesTo.length === 0 || appliesTo.includes(f.floorType))
    .map((f) => f.id);
}

/**
 * Give a project its own editable copy of the master drawing register
 * (DesignCategory rows with projectId = null). Each copied drawing's per-floor
 * membership (`floorIds`) is seeded from its `appliesTo` rule against the
 * project's actual floors. Skips names the project already has, so it is safe
 * to call more than once.
 */
export async function copyTemplateRegister(projectId: string): Promise<number> {
  const [template, existing, floors] = await Promise.all([
    prisma.designCategory.findMany({ where: { projectId: null } }),
    prisma.designCategory.findMany({
      where: { projectId },
      select: { name: true },
    }),
    prisma.floor.findMany({
      where: { projectId },
      select: { id: true, floorType: true },
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
      floorIds: floorIdsForApplies(t.appliesTo as unknown as string[], floors),
      discipline: t.discipline,
    })),
  });
  return missing.length;
}
