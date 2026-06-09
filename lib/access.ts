import type { Role, TaskStatus } from "@prisma/client";

/**
 * Statuses in which a design version is actively awaiting / holding a review
 * decision. In these states the on-site reviewer may see the current version.
 */
const VISIBLE_TO_ONSITE: TaskStatus[] = [
  "PENDING_REVIEW",
  "REVISION_SUBMITTED",
  "APPROVED",
];

/**
 * Whether an on-site employee is allowed to see a specific file version.
 *
 * Business rule: once a design is rejected, the old (rejected) plan is hidden
 * from the on-site team. Only after the designer uploads a NEW version does a
 * plan become visible again — and only ever the CURRENT version, never the
 * superseded history.
 */
export function onsiteCanSeeVersion(
  task: { status: TaskStatus; currentVersion: number },
  version: number
): boolean {
  return (
    VISIBLE_TO_ONSITE.includes(task.status) && version === task.currentVersion
  );
}

/**
 * Whether an on-site employee is routed this task, based on the design
 * category's specialization ("Electrical Design -> Electrical Team").
 * A category with no specialization is reviewable by any on-site employee.
 */
export function onsiteIsRouted(
  user: { specializationId: string | null },
  category: { specializationId: string | null }
): boolean {
  if (!category.specializationId) return true;
  return category.specializationId === user.specializationId;
}

/** Filter a task's files down to what the given role is permitted to see. */
export function visibleFiles<
  T extends { version: number }
>(
  role: Role,
  task: { status: TaskStatus; currentVersion: number },
  files: T[]
): T[] {
  if (role === "ADMIN" || role === "DESIGNER") return files;
  // ONSITE: only the current version, and only while in a reviewable state
  return files.filter((f) => onsiteCanSeeVersion(task, f.version));
}
