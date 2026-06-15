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
 * - A category with no specialization is reviewable by any on-site employee.
 * - An on-site employee with no specialization (e.g. a Site Head) is a
 *   generalist and reviews everything.
 */
export function onsiteIsRouted(
  user: { specializationId: string | null },
  category: { specializationId: string | null }
): boolean {
  if (!category.specializationId) return true;
  if (!user.specializationId) return true; // generalist reviewer
  return category.specializationId === user.specializationId;
}

/** Filter a task's files down to what the given viewer is permitted to see. */
export function visibleFiles<
  T extends { version: number }
>(
  viewer: { role: Role; id: string },
  task: { status: TaskStatus; currentVersion: number; designerId: string | null },
  files: T[],
  rejectedVersions: Set<number> = new Set()
): T[] {
  // admins keep the full version history (including rejected plans)
  if (viewer.role === "ADMIN") return files;
  // designers (and their co-assignees) see the history EXCEPT the rejected
  // plans themselves — only the reviewer's comments / voice / photos remain
  // visible on the task page, never a link to the rejected drawing.
  if (viewer.role === "DESIGNER" || task.designerId === viewer.id)
    return files.filter((f) => !rejectedVersions.has(f.version));
  // other ONSITE reviewers: only the current version, only while reviewable
  return files.filter((f) => onsiteCanSeeVersion(task, f.version));
}

/** Set of file versions that were rejected (hidden from designers). */
export function rejectedVersionSet(
  reviews: { version: number; decision: "APPROVED" | "REJECTED" }[]
): Set<number> {
  return new Set(
    reviews.filter((r) => r.decision === "REJECTED").map((r) => r.version)
  );
}
