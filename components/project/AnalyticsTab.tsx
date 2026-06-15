"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ListChecks,
  Clock,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Layers,
  TrendingUp,
} from "lucide-react";
import { api, StatCard, Skeleton, Avatar } from "@/components/ui";
import { ProgressBar, EASE } from "@/components/motion";

interface Analytics {
  cards: Record<string, number>;
  charts: {
    approvalRate: number;
    designerPerf: { name: string; approved: number; total: number }[];
    floorProgress: { id: string; name: string; approved: number; total: number }[];
  };
}

const CARDS = [
  { key: "total", label: "Total Drawings", icon: <ListChecks size={16} />, accent: "#1e293b", tint: "#eef2f7" },
  { key: "assigned", label: "Awaiting Upload", icon: <Clock size={16} />, accent: "#475569", tint: "#eef2f7" },
  { key: "pending", label: "Pending Review", icon: <Clock size={16} />, accent: "#b45309", tint: "#fef3c7" },
  { key: "approved", label: "Approved", icon: <Check size={16} />, accent: "#15803d", tint: "#dcfce7" },
  { key: "rejected", label: "Rejected", icon: <X size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  { key: "overdue", label: "Overdue", icon: <AlertTriangle size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  { key: "todayDeadlines", label: "Due Today", icon: <Calendar size={16} />, accent: "#1d4ed8", tint: "#dbeafe" },
];

/** Project-scoped analytics: cards, approval ring, team performance, per-floor progress. */
export default function AnalyticsTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api<Analytics>(`/api/dashboard?projectId=${projectId}`).then(setData).catch(() => {});
  }, [projectId]);

  if (!data) return <Skeleton rows={3} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        {CARDS.map((c) => (
          <StatCard
            key={c.key}
            label={c.label}
            value={data.cards[c.key] ?? 0}
            icon={c.icon}
            accent={(data.cards[c.key] ?? 0) > 0 ? c.accent : undefined}
            tint={c.tint}
          />
        ))}
      </div>

      <div className="r-2">
        {/* approval ring */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="card"
          style={{
            padding: "1.4rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div style={{ fontWeight: 700, alignSelf: "flex-start" }}>Approval Rate</div>
          <Ring pct={data.charts.approvalRate} />
          <p style={{ color: "#94a3b8", fontSize: "0.76rem", textAlign: "center" }}>
            Share of reviewed drawings approved in this project.
          </p>
        </motion.div>

        {/* team performance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.08 }}
          className="card"
          style={{ padding: "1.4rem" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 14 }}>
            <TrendingUp size={16} color="#475569" /> Team Performance
          </div>
          {data.charts.designerPerf.length === 0 && (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No assignments yet.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {data.charts.designerPerf.slice(0, 8).map((d, i) => {
              const pct = d.total ? Math.round((d.approved / d.total) * 100) : 0;
              return (
                <div key={d.name} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Avatar name={d.name} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                      <span className="mono" style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                        {d.approved}/{d.total}
                      </span>
                    </div>
                    <ProgressBar
                      pct={pct}
                      height={6}
                      color="linear-gradient(90deg, #3b82f6, #1e3a8a)"
                      delay={0.15 + i * 0.05}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* floor progress */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.14 }}
        className="card"
        style={{ padding: "1.4rem" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 14 }}>
          <Layers size={16} color="#475569" /> Floor Progress
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "12px 22px",
          }}
        >
          {data.charts.floorProgress.map((f, i) => {
            const pct = f.total ? Math.round((f.approved / f.total) * 100) : 0;
            return (
              <div key={f.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8rem",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{f.name}</span>
                  <span className="mono" style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                    {f.approved}/{f.total} · {pct}%
                  </span>
                </div>
                <ProgressBar
                  pct={pct}
                  height={6}
                  color={
                    pct === 100
                      ? "linear-gradient(90deg,#22c55e,#15803d)"
                      : "linear-gradient(90deg,#64748b,#334155)"
                  }
                  delay={0.2 + i * 0.04}
                />
              </div>
            );
          })}
          {data.charts.floorProgress.length === 0 && (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No floors yet.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const R = 48;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", width: 128, height: 128 }}>
      <svg width={128} height={128} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={64} cy={64} r={R} fill="none" stroke="#eef2f7" strokeWidth={11} />
        <motion.circle
          cx={64}
          cy={64}
          r={R}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C - (C * pct) / 100 }}
          transition={{ duration: 1, ease: EASE, delay: 0.2 }}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span className="mono" style={{ fontSize: "1.6rem", fontWeight: 750, color: "#15803d" }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}
