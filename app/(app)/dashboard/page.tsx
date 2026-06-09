"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FolderKanban,
  Clock,
  Check,
  X,
  AlertTriangle,
  Calendar,
  ListChecks,
  Upload,
  TrendingUp,
} from "lucide-react";
import { api, PageHeader, StatCard, Skeleton } from "@/components/ui";
import { Stagger, Item, ProgressBar, EASE } from "@/components/motion";

interface DashboardData {
  role: "ADMIN" | "DESIGNER" | "ONSITE";
  cards: Record<string, number>;
  charts?: {
    approvalRate: number;
    designerPerf: { name: string; approved: number; total: number }[];
  };
}

const ICONS: Record<
  string,
  { icon: React.ReactNode; accent: string; tint: string }
> = {
  projects: { icon: <FolderKanban size={16} />, accent: "#1e293b", tint: "#eef2f7" },
  pending: { icon: <Clock size={16} />, accent: "#b45309", tint: "#fef3c7" },
  submitted: { icon: <Upload size={16} />, accent: "#b45309", tint: "#fef3c7" },
  pendingReviews: { icon: <Clock size={16} />, accent: "#b45309", tint: "#fef3c7" },
  approved: { icon: <Check size={16} />, accent: "#15803d", tint: "#dcfce7" },
  approvals: { icon: <Check size={16} />, accent: "#15803d", tint: "#dcfce7" },
  rejected: { icon: <X size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  rejections: { icon: <X size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  overdue: { icon: <AlertTriangle size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  expired: { icon: <AlertTriangle size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  todayDeadlines: { icon: <Calendar size={16} />, accent: "#1d4ed8", tint: "#dbeafe" },
  assigned: { icon: <ListChecks size={16} />, accent: "#475569", tint: "#eef2f7" },
};

const CARD_DEFS: Record<string, { key: string; label: string }[]> = {
  ADMIN: [
    { key: "projects", label: "Projects" },
    { key: "pending", label: "Pending Designs" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "overdue", label: "Overdue" },
    { key: "todayDeadlines", label: "Today's Deadlines" },
  ],
  DESIGNER: [
    { key: "assigned", label: "Assigned" },
    { key: "submitted", label: "Submitted" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "overdue", label: "Overdue" },
  ],
  ONSITE: [
    { key: "pendingReviews", label: "Pending Reviews" },
    { key: "approvals", label: "Approvals" },
    { key: "rejections", label: "Rejections" },
    { key: "expired", label: "Expired Reviews" },
  ],
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: "#b91c1c" }}>{error}</p>;
  if (!data)
    return (
      <>
        <PageHeader title="Dashboard" />
        <Skeleton rows={3} />
      </>
    );

  const defs = CARD_DEFS[data.role];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of design progress, accountability and deadlines"
      />

      <Stagger
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: data.charts ? "1.6rem" : 0,
        }}
      >
        {defs.map((d) => {
          const meta = ICONS[d.key];
          const v = data.cards[d.key] ?? 0;
          return (
            <Item key={d.key}>
              <StatCard
                label={d.label}
                value={v}
                icon={meta?.icon}
                accent={v ? meta?.accent : undefined}
                tint={meta?.tint}
              />
            </Item>
          );
        })}
      </Stagger>

      {data.charts && (
        <div className="r-dash">
          <ApprovalRing pct={data.charts.approvalRate} />

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.15 }}
            className="card"
            style={{ padding: "1.4rem" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              <TrendingUp size={17} color="#475569" />
              Designer Performance
            </div>
            {data.charts.designerPerf.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>No designers yet.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {data.charts.designerPerf.map((d, i) => {
                const pct = d.total ? Math.round((d.approved / d.total) * 100) : 0;
                return (
                  <div key={d.name}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.84rem",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{d.name}</span>
                      <span className="mono" style={{ color: "#64748b" }}>
                        {d.approved}/{d.total} approved
                      </span>
                    </div>
                    <ProgressBar
                      pct={pct}
                      height={7}
                      color="linear-gradient(90deg, #475569, #1e293b)"
                      delay={0.2 + i * 0.08}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

function ApprovalRing({ pct }: { pct: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
      className="card"
      style={{
        padding: "1.4rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 700, alignSelf: "flex-start", marginBottom: 6 }}>
        Approval Rate
      </div>
      <div style={{ position: "relative", width: 140, height: 140 }}>
        <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={70} cy={70} r={R} fill="none" stroke="#eef2f7" strokeWidth={12} />
          <motion.circle
            cx={70}
            cy={70}
            r={R}
            fill="none"
            stroke="url(#grad)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (C * pct) / 100 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.25 }}
          />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
          </defs>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            flexDirection: "column",
          }}
        >
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mono"
            style={{ fontSize: "1.9rem", fontWeight: 750, color: "#15803d" }}
          >
            {pct}%
          </motion.span>
        </div>
      </div>
      <p style={{ color: "#94a3b8", fontSize: "0.76rem", textAlign: "center", marginTop: 4 }}>
        Share of reviewed designs approved.
      </p>
    </motion.div>
  );
}
