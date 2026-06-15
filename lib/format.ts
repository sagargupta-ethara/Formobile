// Shared, framework-agnostic display helpers (safe on client & server).

export const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  PENDING_REVIEW: "Pending Review",
  REVISION_SUBMITTED: "Revision Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

// Returns inline style tokens {bg, fg} for a status badge.
export function statusStyle(status: string): { bg: string; fg: string } {
  switch (status) {
    case "APPROVED":
      return { bg: "#dcfce7", fg: "#15803d" };
    case "REJECTED":
      return { bg: "#fee2e2", fg: "#b91c1c" };
    case "PENDING_REVIEW":
    case "REVISION_SUBMITTED":
      return { bg: "#fef3c7", fg: "#b45309" };
    default:
      return { bg: "#f1f5f9", fg: "#475569" };
  }
}

export function priorityStyle(p: string): { bg: string; fg: string } {
  switch (p) {
    case "URGENT":
      return { bg: "#fee2e2", fg: "#b91c1c" };
    case "HIGH":
      return { bg: "#ffedd5", fg: "#c2410c" };
    case "MEDIUM":
      return { bg: "#f1f5f9", fg: "#475569" };
    default:
      return { bg: "#f8fafc", fg: "#64748b" };
  }
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  DESIGN: "Design",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  UPCOMING: "Upcoming",
  COMPLETED: "Completed",
};

export function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d?: string | Date | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Human countdown to a deadline/SLA, e.g. "in 5h 12m" or "overdue 2h".
export function countdown(due?: string | Date | null, now = Date.now()): {
  text: string;
  overdue: boolean;
} {
  if (!due) return { text: "—", overdue: false };
  const target = (typeof due === "string" ? new Date(due) : due).getTime();
  let diff = target - now;
  const overdue = diff < 0;
  diff = Math.abs(diff);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const d = Math.floor(h / 24);
  const body =
    d >= 1 ? `${d}d ${h % 24}h` : h >= 1 ? `${h}h ${m}m` : `${m}m`;
  return { text: overdue ? `overdue ${body}` : `in ${body}`, overdue };
}
