"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, Clock, Check, X, AlertTriangle, Send, CalendarClock, Layers } from "lucide-react";
import { api, StatCard, Skeleton, StatusBadge } from "@/components/ui";
import { fmtDate, countdown } from "@/lib/format";

interface DeadlineItem {
  id: string;
  name: string;
  floorName: string;
  deadline: string;
  status: string;
  overdue: boolean;
}
interface Data {
  cards: { total: number; assigned: number; submitted: number; approved: number; rejected: number; overdue: number };
  charts: {
    approvalRate: number;
    onTimeRate: number;
    floorProgress: { id: string; name: string; approved: number; total: number }[];
    workload: { discipline: string; count: number }[];
    deadlines: DeadlineItem[];
  };
}

const DISC_LABEL: Record<string, string> = {
  INTERIOR: "Interior Design",
  STRUCTURE: "Architecture",
  MEP: "MEP",
  WOODWORK: "Woodwork",
};

const CARDS = [
  { key: "overdue", label: "Overdue", icon: <AlertTriangle size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  { key: "assigned", label: "To Upload", icon: <Clock size={16} />, accent: "#b45309", tint: "#fef3c7" },
  { key: "submitted", label: "In Review", icon: <Send size={16} />, accent: "#1d4ed8", tint: "#dbeafe" },
  { key: "approved", label: "Approved", icon: <Check size={16} />, accent: "#15803d", tint: "#dcfce7" },
  { key: "rejected", label: "Rejected", icon: <X size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  { key: "total", label: "My Drawings", icon: <ListChecks size={16} />, accent: "#1e293b", tint: "#eef2f7" },
] as const;

/** Designer's own analytics for a single project — deadline-first. */
export default function DesignerAnalyticsTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    api<Data>(`/api/dashboard?projectId=${projectId}`).then(setData).catch(() => {});
  }, [projectId]);

  if (!data) return <Skeleton rows={3} />;

  const c = data.cards;
  const ch = data.charts;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="designer-analytics">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={card.label}
            value={c[card.key] ?? 0}
            icon={card.icon}
            accent={(c[card.key] ?? 0) > 0 ? card.accent : undefined}
            tint={card.tint}
          />
        ))}
      </div>

      <div className="r-2">
        {/* HERO: deadlines */}
        <div className="card" style={{ padding: "1.3rem" }} data-testid="designer-deadlines">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 4 }}>
            <CalendarClock size={16} color="#b45309" /> My Deadlines
          </div>
          <p style={{ fontSize: "0.76rem", color: "#94a3b8", margin: "0 0 12px" }}>
            Drawings still to finish, soonest first. Overdue in red.
          </p>
          {ch.deadlines.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
              No pending deadlines — you&apos;re all caught up. 🎉
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ch.deadlines.map((d) => (
                <Link
                  key={d.id}
                  href={`/tasks/${d.id}`}
                  data-testid={`deadline-item-${d.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "0.6rem 0.75rem",
                    borderRadius: 9,
                    border: "1px solid",
                    borderColor: d.overdue ? "#fecaca" : "#eef2f7",
                    background: d.overdue ? "#fef2f2" : "#fff",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
                      {d.name}
                    </span>
                    <span style={{ display: "block", fontSize: "0.74rem", color: "#94a3b8" }}>
                      {d.floorName} · due {fmtDate(d.deadline)}
                    </span>
                  </span>
                  <span
                    className="mono"
                    style={{
                      flexShrink: 0,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      color: d.overdue ? "#b91c1c" : "#b45309",
                    }}
                  >
                    {d.overdue ? "Overdue" : countdown(d.deadline).text}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quality + on-time */}
        <div className="card" style={{ padding: "1.3rem", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontWeight: 700 }}>My Performance</div>
          <Meter label="On-time (not overdue)" pct={ch.onTimeRate} good />
          <Meter label="Approval rate (approved vs rejected)" pct={ch.approvalRate} good />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: "0.82rem", marginBottom: 8, color: "#475569" }}>
              <Layers size={14} /> Workload by department
            </div>
            {ch.workload.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Nothing assigned yet.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ch.workload.map((w) => (
                  <span
                    key={w.discipline}
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.6rem",
                      borderRadius: 999,
                      background: "#f1f5f9",
                      color: "#475569",
                    }}
                  >
                    {DISC_LABEL[w.discipline] ?? w.discipline}: {w.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floor progress */}
      <div className="card" style={{ padding: "1.3rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 12 }}>
          <Layers size={16} color="#475569" /> My Progress by Floor
        </div>
        {ch.floorProgress.length === 0 ? (
          <p style={{ fontSize: "0.82rem", color: "#94a3b8" }}>No assignments yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px 22px" }}>
            {ch.floorProgress.map((f) => {
              const pct = f.total ? Math.round((f.approved / f.total) * 100) : 0;
              return (
                <div key={f.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>{f.name}</span>
                    <span className="mono" style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                      {f.approved}/{f.total} · {pct}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "linear-gradient(90deg,#22c55e,#15803d)" : "linear-gradient(90deg,#64748b,#334155)", transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Meter({ label, pct, good }: { label: string; pct: number; good?: boolean }) {
  const color = good
    ? pct >= 70
      ? "linear-gradient(90deg,#22c55e,#15803d)"
      : pct >= 40
      ? "linear-gradient(90deg,#f59e0b,#b45309)"
      : "linear-gradient(90deg,#ef4444,#b91c1c)"
    : "linear-gradient(90deg,#64748b,#334155)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: 5 }}>
        <span style={{ fontWeight: 600, color: "#475569" }}>{label}</span>
        <span className="mono" style={{ fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
