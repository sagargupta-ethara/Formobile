"use client";

import { useEffect, useState } from "react";
import { ListChecks, Clock, Check, X, AlertTriangle, Send } from "lucide-react";
import { api, StatCard, Skeleton } from "@/components/ui";

interface Data {
  cards: { total: number; assigned: number; submitted: number; approved: number; rejected: number; overdue: number };
}

const CARDS = [
  { key: "total", label: "My Drawings", icon: <ListChecks size={16} />, accent: "#1e293b", tint: "#eef2f7" },
  { key: "assigned", label: "To Upload", icon: <Clock size={16} />, accent: "#475569", tint: "#eef2f7" },
  { key: "submitted", label: "In Review", icon: <Send size={16} />, accent: "#b45309", tint: "#fef3c7" },
  { key: "approved", label: "Approved", icon: <Check size={16} />, accent: "#15803d", tint: "#dcfce7" },
  { key: "rejected", label: "Rejected", icon: <X size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
  { key: "overdue", label: "Overdue", icon: <AlertTriangle size={16} />, accent: "#b91c1c", tint: "#fee2e2" },
] as const;

/** Designer's own analytics for a single project (their tasks only). */
export default function DesignerAnalyticsTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    api<Data>(`/api/dashboard?projectId=${projectId}`).then(setData).catch(() => {});
  }, [projectId]);

  if (!data) return <Skeleton rows={3} />;

  const c = data.cards;
  const reviewed = c.approved + c.rejected;
  const rate = reviewed > 0 ? Math.round((c.approved / reviewed) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} data-testid="designer-analytics">
      <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
        Your personal progress on this project.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
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
      <div className="card" style={{ padding: "1.4rem", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>My Approval Rate</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ height: 10, borderRadius: 999, background: "#eef2f7", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${rate}%`, background: "linear-gradient(90deg,#22c55e,#15803d)", transition: "width 0.6s ease" }} />
          </div>
        </div>
        <span className="mono" style={{ fontSize: "1.3rem", fontWeight: 750, color: "#15803d" }}>{rate}%</span>
      </div>
    </div>
  );
}
