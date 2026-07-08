"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  FileText,
  Search,
  Check,
  Clock,
  RotateCcw,
  Hammer,
} from "lucide-react";
import DrawingReviewModal from "@/components/DrawingReviewModal";
import { STATUS_LABEL, statusStyle, PROJECT_STATUS_LABEL } from "@/lib/format";

/* ---- shared shapes (mirror the project page) ---- */
interface Floor {
  id: string;
  floorName: string;
  floorType: string;
  order: number;
}
interface Task {
  id: string;
  status: string;
  floorId: string;
  category: { id: string; name: string; discipline?: string };
  reviewer?: { id: string; name: string } | null;
}
interface Project {
  id: string;
  name: string;
  code: string;
  location: string | null;
  status: string;
  floors: Floor[];
}

const DISCIPLINES = [
  { key: "INTERIOR", label: "Interior Design" },
  { key: "STRUCTURE", label: "Architecture" },
  { key: "MEP", label: "MEP" },
  { key: "WOODWORK", label: "Woodwork" },
] as const;

type StatusKey = "APPROVED" | "PENDING" | "REJECTED" | "PROGRESS";

function statusKey(s: string): StatusKey {
  if (s === "APPROVED") return "APPROVED";
  if (s === "PENDING_REVIEW" || s === "REVISION_SUBMITTED") return "PENDING";
  if (s === "REJECTED") return "REJECTED";
  return "PROGRESS";
}

const PROJECT_STATUS_TINT: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "#dcfce7", fg: "#15803d" },
  PLANNING: { bg: "#dbeafe", fg: "#1d4ed8" },
  ON_HOLD: { bg: "#fef3c7", fg: "#b45309" },
  UPCOMING: { bg: "#e0f2fe", fg: "#0369a1" },
  COMPLETED: { bg: "#eef2f7", fg: "#475569" },
};

type FilterKey = "REVIEW" | "APPROVED" | "ALL";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "REVIEW", label: "To review" },
  { key: "APPROVED", label: "Approved" },
  { key: "ALL", label: "All" },
];

function matchesFilter(s: string, f: FilterKey): boolean {
  if (f === "ALL") return true;
  if (f === "APPROVED") return s === "APPROVED";
  // REVIEW = anything needing the reviewer's action
  return s === "PENDING_REVIEW" || s === "REVISION_SUBMITTED" || s === "REJECTED";
}

export default function OnSiteProjectBoard({
  project,
  tasks,
  meId,
  onReload,
}: {
  project: Project;
  tasks: Task[];
  meId: string;
  onReload: () => void;
}) {
  const floorsBottomFirst = useMemo(
    () => [...project.floors].sort((a, b) => a.order - b.order),
    [project.floors]
  );

  const defaultFloor =
    project.floors.find((f) => /ground/i.test(f.floorName))?.id ??
    project.floors[0]?.id ??
    null;

  const [floorId, setFloorId] = useState<string | null>(defaultFloor);
  const [disc, setDisc] = useState<string>("INTERIOR");
  const [filter, setFilter] = useState<FilterKey>("REVIEW");
  const [search, setSearch] = useState("");
  const [openTask, setOpenTask] = useState<string | null>(null);

  // counts per floor (drawings visible to this on-site user)
  const floorCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) m[t.floorId] = (m[t.floorId] ?? 0) + 1;
    return m;
  }, [tasks]);

  const floorTasks = useMemo(
    () => tasks.filter((t) => t.floorId === floorId),
    [tasks, floorId]
  );

  const discCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of floorTasks) {
      const d = t.category.discipline ?? "INTERIOR";
      m[d] = (m[d] ?? 0) + 1;
    }
    return m;
  }, [floorTasks]);

  const drawings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return floorTasks
      .filter((t) => (t.category.discipline ?? "INTERIOR") === disc)
      .filter((t) => matchesFilter(t.status, filter))
      .filter((t) => !q || t.category.name.toLowerCase().includes(q))
      .sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [floorTasks, disc, filter, search]);

  const selectedFloorName =
    project.floors.find((f) => f.id === floorId)?.floorName ?? "—";
  const discLabel = DISCIPLINES.find((d) => d.key === disc)?.label ?? disc;
  const tint = PROJECT_STATUS_TINT[project.status] ?? PROJECT_STATUS_TINT.COMPLETED;

  return (
    <div data-testid="onsite-project-board">
      {/* back + header */}
      <Link
        href="/projects"
        data-testid="onsite-back-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: "0.82rem",
          color: "#64748b",
          textDecoration: "none",
          marginBottom: 12,
        }}
      >
        <ChevronLeft size={16} /> All sites
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            className="mono"
            style={{ fontSize: "0.72rem", color: "#94a3b8", letterSpacing: "0.04em" }}
          >
            {project.code}
          </div>
          <h1
            className="display"
            style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", margin: "2px 0 2px", lineHeight: 1.15 }}
          >
            {project.name}
          </h1>
          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
            {project.location || "On-site review"}
          </div>
        </div>
        <span
          data-testid="onsite-project-status"
          style={{
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.74rem",
            fontWeight: 600,
            padding: "0.3rem 0.7rem",
            borderRadius: 999,
            background: tint.bg,
            color: tint.fg,
          }}
        >
          ● {PROJECT_STATUS_LABEL[project.status] ?? project.status}
        </span>
      </div>

      {/* FLOOR top-bar */}
      <div className="card" style={{ padding: "0.75rem", marginBottom: 14 }}>
        <div
          className="label"
          style={{ fontSize: "0.66rem", letterSpacing: "0.14em", marginBottom: 8, paddingLeft: 4 }}
        >
          FLOORS — TAP TO OPEN
        </div>
        <div
          data-testid="onsite-floor-bar"
          style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}
        >
          {floorsBottomFirst.map((f) => {
            const active = f.id === floorId;
            return (
              <button
                key={f.id}
                data-testid={`onsite-floor-${f.id}`}
                onClick={() => setFloorId(f.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  flexShrink: 0,
                  border: active ? "1px solid transparent" : "1px solid var(--color-line, #e3e9f2)",
                  background: active
                    ? "linear-gradient(180deg,#243249,#0f172a)"
                    : "#fff",
                  color: active ? "#fff" : "#1e293b",
                  borderRadius: 11,
                  padding: "0.55rem 0.85rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  boxShadow: active ? "0 6px 16px -8px rgba(15,23,42,.6)" : "none",
                }}
              >
                {shortFloor(f.floorName)}
                <span
                  className="mono"
                  style={{
                    fontSize: "0.68rem",
                    color: active ? "#cbd5e1" : "#94a3b8",
                  }}
                >
                  {floorCount[f.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DEPARTMENT pills */}
      <div
        data-testid="onsite-discipline-pills"
        style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 14 }}
      >
        {DISCIPLINES.map((d) => {
          const active = d.key === disc;
          const Icon = d.key === "WOODWORK" ? Hammer : FileText;
          return (
            <button
              key={d.key}
              data-testid={`onsite-pill-${d.key}`}
              onClick={() => setDisc(d.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
                border: active ? "1px solid transparent" : "1px solid var(--color-line, #e3e9f2)",
                background: active ? "linear-gradient(180deg,#243249,#0f172a)" : "#fff",
                color: active ? "#fff" : "#1e293b",
                borderRadius: 999,
                padding: "0.5rem 0.9rem",
                fontSize: "0.84rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              <Icon size={14} style={{ opacity: 0.8 }} /> {d.label}
              <span
                className="mono"
                style={{
                  fontSize: "0.66rem",
                  background: active ? "rgba(255,255,255,.18)" : "#f1f5f9",
                  color: active ? "#fff" : "#64748b",
                  borderRadius: 999,
                  padding: "0.06rem 0.4rem",
                }}
              >
                {discCount[d.key] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* DRAWINGS list */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "1rem 1.1rem",
            borderBottom: "1px solid #eef2f7",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>
              {selectedFloorName} · {discLabel}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              {drawings.length} {drawings.length === 1 ? "drawing" : "drawings"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "#fff",
                border: "1px solid var(--color-line, #e3e9f2)",
                borderRadius: 9,
                padding: "0.35rem 0.6rem",
              }}
            >
              <Search size={15} color="#94a3b8" />
              <input
                data-testid="onsite-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drawings…"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: "0.84rem",
                  background: "transparent",
                  width: 130,
                  color: "#1e293b",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                background: "#f1f5f9",
                borderRadius: 9,
                padding: 3,
                fontSize: "0.76rem",
                fontWeight: 600,
              }}
            >
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  data-testid={`onsite-filter-${f.key}`}
                  onClick={() => setFilter(f.key)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "0.3rem 0.65rem",
                    borderRadius: 7,
                    background: filter === f.key ? "#fff" : "transparent",
                    color: filter === f.key ? "#0f172a" : "#64748b",
                    boxShadow: filter === f.key ? "0 1px 2px rgba(15,23,42,.12)" : "none",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {drawings.length === 0 ? (
          <div
            data-testid="onsite-empty"
            style={{ padding: "2.5rem 1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.9rem" }}
          >
            No drawings match.
          </div>
        ) : (
          <div>
            {drawings.map((t, i) => {
              const sk = statusKey(t.status);
              const ss = statusStyle(t.status);
              return (
                <div
                  key={t.id}
                  data-testid={`onsite-drawing-${t.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0.9rem 1.1rem",
                    borderTop: i ? "1px solid #f1f5f9" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#f1f5f9",
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.category.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          padding: "0.16rem 0.5rem",
                          borderRadius: 999,
                          background: ss.bg,
                          color: ss.fg,
                        }}
                      >
                        {sk === "APPROVED" ? <Check size={11} /> : sk === "PENDING" ? <Clock size={11} /> : sk === "REJECTED" ? <RotateCcw size={11} /> : null}
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                      {t.reviewer?.name && (
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                          {t.reviewer.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    data-testid={`onsite-open-${t.id}`}
                    onClick={() => setOpenTask(t.id)}
                    style={{ flexShrink: 0, minHeight: 42, padding: "0 1.1rem" }}
                  >
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {openTask && (
        <DrawingReviewModal
          taskId={openTask}
          meId={meId}
          onClose={() => setOpenTask(null)}
          onDone={onReload}
        />
      )}
    </div>
  );
}

/** Compact floor label for the top bar (e.g. "Ground Floor" -> "Ground").
 *  Basement levels are shown in full ("Basement", "Basement 2"). */
function shortFloor(name: string): string {
  return name.replace(/\s*Floor$/i, "").trim();
}
