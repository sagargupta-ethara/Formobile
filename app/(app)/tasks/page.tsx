"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, ChevronRight, Clock, CalendarDays, SlidersHorizontal, X, AlertTriangle } from "lucide-react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  StatusBadge,
  TaskPeople,
} from "@/components/ui";
import Select from "@/components/Select";
import { Stagger, Item } from "@/components/motion";
import AssignTaskModal from "@/components/AssignTaskModal";
import { fmtDateTime, countdown } from "@/lib/format";

interface Task {
  id: string;
  status: string;
  deadline: string | null;
  reviewDueAt?: string | null;
  floorId: string;
  project: { id: string; name: string; code: string };
  floor: { floorName: string };
  category: { name: string; discipline?: string };
  designer: { id?: string; name: string } | null;
  reviewer?: { id: string; name: string } | null;
  assignees?: { user: { id: string; name: string } }[];
}

const DISCIPLINE_LABEL: Record<string, string> = {
  INTERIOR: "Interior Design",
  STRUCTURE: "Architecture",
  MEP: "MEP",
  WOODWORK: "Woodwork",
};

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "PENDING", label: "Pending Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [role, setRole] = useState("");
  const [meId, setMeId] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [assignOpen, setAssignOpen] = useState(false);
  // advanced filters
  const [projectF, setProjectF] = useState("");
  const [floorF, setFloorF] = useState("");
  const [discF, setDiscF] = useState("");
  const [personF, setPersonF] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function load() {
    const [t, me] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ user: { id: string; role: string } }>("/api/auth/me"),
    ]);
    setTasks(t.tasks);
    setRole(me.user?.role ?? "");
    setMeId(me.user?.id ?? "");
  }
  useEffect(() => {
    load();
  }, []);

  const all = tasks ?? [];
  const now = Date.now();
  function personIds(t: Task): string[] {
    const ids = (t.assignees?.map((a) => a.user.id) ?? []) as string[];
    if (t.designer?.id) ids.push(t.designer.id);
    if (t.reviewer?.id) ids.push(t.reviewer.id);
    return ids;
  }
  function isOverdue(t: Task): boolean {
    const pending = t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED";
    if (pending && t.reviewDueAt) return new Date(t.reviewDueAt).getTime() < now;
    if (t.deadline && t.status !== "APPROVED")
      return new Date(t.deadline).getTime() < now;
    return false;
  }

  // option lists derived from the loaded tasks
  const projectOpts = [...new Map(all.map((t) => [t.project.id, t.project.name])).entries()]
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const floorOpts = [...new Set(all.map((t) => t.floor.floorName))]
    .map((n) => ({ value: n, label: n }));
  const discOpts = [...new Set(all.map((t) => t.category.discipline).filter(Boolean) as string[])]
    .map((d) => ({ value: d, label: DISCIPLINE_LABEL[d] ?? d }));
  const personOpts = [
    ...new Map(
      all.flatMap((t) => [
        ...(t.assignees?.map((a) => [a.user.id, a.user.name] as const) ?? []),
        ...(t.designer?.id ? [[t.designer.id, t.designer.name] as const] : []),
        ...(t.reviewer?.id ? [[t.reviewer.id, t.reviewer.name] as const] : []),
      ])
    ).entries(),
  ]
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const activeAdvanced =
    !!projectF || !!floorF || !!discF || !!personF || overdueOnly || !!dateFrom || !!dateTo;

  const fromMs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
  const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;

  const filtered = all.filter((t) => {
    // Designers: "My Tasks" shows only tasks assigned to them.
    if (role === "DESIGNER" && meId) {
      const mine =
        t.designer?.id === meId ||
        (t.assignees?.some((a) => a.user.id === meId) ?? false);
      if (!mine) return false;
    }
    if (filter === "PENDING") {
      if (!(t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED"))
        return false;
    } else if (filter !== "ALL" && t.status !== filter) return false;
    if (projectF && t.project.id !== projectF) return false;
    if (floorF && t.floor.floorName !== floorF) return false;
    if (discF && t.category.discipline !== discF) return false;
    if (personF && !personIds(t).includes(personF)) return false;
    if (fromMs || toMs) {
      if (!t.deadline) return false;
      const d = new Date(t.deadline).getTime();
      if (fromMs && d < fromMs) return false;
      if (toMs && d > toMs) return false;
    }
    if (overdueOnly && !isOverdue(t)) return false;
    return true;
  });

  const title =
    role === "DESIGNER" ? "My Tasks" : role === "ONSITE" ? "Reviews" : "Design Tasks";

  return (
    <>
      <PageHeader
        eyebrow="Workflow"
        title={title}
        subtitle={
          role === "ONSITE"
            ? "Designs routed to your team for approval"
            : "Track assignments, uploads and approvals"
        }
        action={
          role === "ADMIN" && (
            <button className="btn btn-primary" onClick={() => setAssignOpen(true)}>
              <Plus /> Assign Task
            </button>
          )
        }
      />

      <div
        style={{
          display: "inline-flex",
          gap: 2,
          marginBottom: 18,
          padding: 4,
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 12,
          boxShadow: "var(--shadow-sm)",
          flexWrap: "wrap",
        }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                position: "relative",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "0.45rem 0.85rem",
                borderRadius: 9,
                fontSize: "0.82rem",
                fontWeight: 600,
                color: active ? "#fff" : "#64748b",
                transition: "color 0.2s ease",
              }}
            >
              {active && (
                <motion.span
                  layoutId="task-filter"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 9,
                    background: "linear-gradient(180deg, #1e293b, #0f172a)",
                    zIndex: 0,
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>{f.label}</span>
            </button>
          );
        })}
      </div>

      {/* advanced filters */}
      <div style={{ marginBottom: 16 }}>
        <button
          data-testid="tasks-filters-toggle"
          onClick={() => setShowAdvanced((s) => !s)}
          className="btn btn-ghost"
          style={{ fontSize: "0.8rem", padding: "0.4rem 0.7rem" }}
        >
          <SlidersHorizontal size={14} /> Filters
          {activeAdvanced && (
            <span
              className="mono"
              style={{
                marginLeft: 6,
                background: "#1e293b",
                color: "#fff",
                borderRadius: 999,
                fontSize: "0.62rem",
                padding: "0.05rem 0.4rem",
              }}
            >
              on
            </span>
          )}
        </button>

        {showAdvanced && (
          <div
            data-testid="tasks-filter-panel"
            className="card"
            style={{ marginTop: 8, padding: "0.9rem 1rem", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}
          >
            <div style={{ minWidth: 160, flex: "1 1 160px" }}>
              <label className="label">Project</label>
              <Select value={projectF} onChange={setProjectF} placeholder="All projects" searchable
                options={[{ value: "", label: "All projects" }, ...projectOpts]} />
            </div>
            <div style={{ minWidth: 140, flex: "1 1 140px" }}>
              <label className="label">Floor</label>
              <Select value={floorF} onChange={setFloorF} placeholder="All floors"
                options={[{ value: "", label: "All floors" }, ...floorOpts]} />
            </div>
            <div style={{ minWidth: 140, flex: "1 1 140px" }}>
              <label className="label">Discipline</label>
              <Select value={discF} onChange={setDiscF} placeholder="All disciplines"
                options={[{ value: "", label: "All disciplines" }, ...discOpts]} />
            </div>
            <div style={{ minWidth: 160, flex: "1 1 160px" }}>
              <label className="label">Person</label>
              <Select value={personF} onChange={setPersonF} placeholder="Anyone" searchable
                options={[{ value: "", label: "Anyone" }, ...personOpts]} />
            </div>
            <div style={{ minWidth: 130, flex: "1 1 130px" }}>
              <label className="label">Deadline from</label>
              <input
                type="date"
                data-testid="tasks-date-from"
                className="input"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ cursor: "pointer" }}
              />
            </div>
            <div style={{ minWidth: 130, flex: "1 1 130px" }}>
              <label className="label">Deadline to</label>
              <input
                type="date"
                data-testid="tasks-date-to"
                className="input"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ cursor: "pointer" }}
              />
            </div>
            <button
              data-testid="tasks-overdue-toggle"
              onClick={() => setOverdueOnly((o) => !o)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid",
                borderColor: overdueOnly ? "#b91c1c" : "var(--color-line)",
                background: overdueOnly ? "#fee2e2" : "#fff",
                color: overdueOnly ? "#b91c1c" : "#64748b",
                borderRadius: 999,
                padding: "0.5rem 0.8rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                height: 40,
              }}
            >
              <AlertTriangle size={14} /> Overdue only
            </button>
            {activeAdvanced && (
              <button
                data-testid="tasks-filters-clear"
                onClick={() => {
                  setProjectF(""); setFloorF(""); setDiscF(""); setPersonF(""); setOverdueOnly(false); setDateFrom(""); setDateTo("");
                }}
                className="btn btn-ghost"
                style={{ fontSize: "0.78rem", padding: "0.45rem 0.7rem", height: 40 }}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {!tasks ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <Empty>No tasks in this view.</Empty>
      ) : (
        <Stagger className="card" style={{ overflow: "hidden", padding: 0 }}>
          <div className="task-row list-head" style={{ padding: "0.6rem 1.2rem" }}>
            <span>Design Task</span>
            <span>Team</span>
            <span>Schedule</span>
            <span style={{ textAlign: "right" }}>Status</span>
            <span />
          </div>
          {filtered.map((t, i) => {
            const isPending =
              t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED";
            const cd = isPending && t.reviewDueAt ? countdown(t.reviewDueAt) : null;
            return (
              <Item key={t.id}>
                <Link
                  href={`/projects/${t.project.id}?floor=${t.floorId}`}
                  className="task-row row-link"
                  style={{
                    padding: "0.95rem 1.2rem",
                    borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 650, fontSize: "0.92rem" }}>
                      {t.category.name}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      {t.project.name} · {t.floor.floorName}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <TaskPeople
                      assignees={
                        t.assignees?.length
                          ? t.assignees.map((a) => a.user.name)
                          : t.designer
                          ? [t.designer.name]
                          : []
                      }
                      reviewer={t.reviewer?.name ?? null}
                    />
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                    {cd ? (
                      <span
                        className="mono"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          color: cd.overdue ? "#b91c1c" : "#b45309",
                          fontWeight: 600,
                        }}
                      >
                        <Clock size={13} /> {cd.text}
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <CalendarDays size={13} color="#94a3b8" /> {fmtDateTime(t.deadline)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                    {isOverdue(t) && (
                      <span
                        data-testid={`overdue-badge-${t.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.4rem",
                          borderRadius: 999,
                          background: "#fee2e2",
                          color: "#b91c1c",
                        }}
                      >
                        <AlertTriangle size={10} /> Overdue
                      </span>
                    )}
                    <StatusBadge status={t.status} />
                  </div>
                  <ChevronRight size={16} color="#cbd5e1" />
                </Link>
              </Item>
            );
          })}
        </Stagger>
      )}

      {assignOpen && (
        <AssignTaskModal
          onClose={() => setAssignOpen(false)}
          onCreated={() => {
            setAssignOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}
