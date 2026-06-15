"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, ChevronRight, Clock, CalendarDays } from "lucide-react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  StatusBadge,
  TaskPeople,
} from "@/components/ui";
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
  category: { name: string };
  designer: { name: string } | null;
  reviewer?: { name: string } | null;
  assignees?: { user: { id: string; name: string } }[];
}

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
  const [filter, setFilter] = useState("ALL");
  const [assignOpen, setAssignOpen] = useState(false);

  async function load() {
    const [t, me] = await Promise.all([
      api<{ tasks: Task[] }>("/api/tasks"),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    setTasks(t.tasks);
    setRole(me.user?.role ?? "");
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = (tasks ?? []).filter((t) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING")
      return t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED";
    return t.status === filter;
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
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
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
