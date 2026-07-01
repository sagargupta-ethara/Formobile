"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload, X as XIcon, AlertTriangle, ListChecks, Clock } from "lucide-react";
import { api, PageHeader, Skeleton, Empty } from "@/components/ui";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  ASSIGNED: { icon: <ListChecks size={15} />, color: "#1d4ed8", bg: "#dbeafe", label: "Assigned" },
  UPLOADED: { icon: <Upload size={15} />, color: "#6d28d9", bg: "#ede9fe", label: "Uploaded" },
  REVISION: { icon: <Upload size={15} />, color: "#6d28d9", bg: "#ede9fe", label: "Revision" },
  APPROVED: { icon: <Check size={15} />, color: "#15803d", bg: "#dcfce7", label: "Approved" },
  REJECTED: { icon: <XIcon size={15} />, color: "#b91c1c", bg: "#fee2e2", label: "Rejected" },
  REVIEW_OVERDUE: { icon: <AlertTriangle size={15} />, color: "#b45309", bg: "#fef3c7", label: "Overdue" },
  DEADLINE: { icon: <Clock size={15} />, color: "#b45309", bg: "#fef3c7", label: "Deadline" },
};

function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FILTERS = ["ALL", "UNREAD", "ASSIGNED", "APPROVED", "REJECTED", "REVIEW_OVERDUE", "DEADLINE"] as const;
const FILTER_LABEL: Record<string, string> = {
  ALL: "All",
  UNREAD: "Unread",
  ASSIGNED: "Assigned",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVIEW_OVERDUE: "Overdue",
  DEADLINE: "Deadlines",
};

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[] | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const load = useCallback(async () => {
    const d = await api<{ notifications: Notif[] }>("/api/notifications?all=1");
    setItems(d.notifications);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAllRead() {
    setItems((xs) =>
      xs ? xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) : xs
    );
    await fetch("/api/notifications", { method: "PATCH", body: "{}" }).catch(() => {});
  }

  async function openItem(n: Notif) {
    if (!n.readAt) {
      setItems((xs) =>
        xs ? xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) : xs
      );
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  const unread = (items ?? []).filter((n) => !n.readAt).length;
  const shown = (items ?? []).filter((n) =>
    filter === "ALL" ? true : filter === "UNREAD" ? !n.readAt : n.type === filter
  );

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up"}
        action={
          unread > 0 && (
            <button
              className="btn btn-ghost"
              data-testid="notifications-mark-all"
              onClick={markAllRead}
            >
              <Check size={15} /> Mark all read
            </button>
          )
        }
      />

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              data-testid={`notif-filter-${f}`}
              onClick={() => setFilter(f)}
              style={{
                border: "1px solid",
                borderColor: active ? "#1e293b" : "var(--color-line)",
                background: active ? "#1e293b" : "#fff",
                color: active ? "#fff" : "#64748b",
                borderRadius: 999,
                padding: "0.3rem 0.75rem",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {FILTER_LABEL[f]}
            </button>
          );
        })}
      </div>

      {!items ? (
        <Skeleton rows={5} />
      ) : shown.length === 0 ? (
        <Empty>No notifications here.</Empty>
      ) : (
        <div className="card" style={{ padding: 6 }}>
          {shown.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.ASSIGNED;
            return (
              <button
                key={n.id}
                data-testid={`notif-item-${n.id}`}
                onClick={() => openItem(n)}
                style={{
                  display: "flex",
                  gap: 12,
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderRadius: 10,
                  background: n.readAt ? "transparent" : "#f0f6ff",
                  padding: "0.85rem 0.9rem",
                  cursor: "pointer",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    background: meta.bg,
                    color: meta.color,
                    marginTop: 1,
                  }}
                >
                  {meta.icon}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.88rem",
                      fontWeight: n.readAt ? 500 : 700,
                      color: "#1e293b",
                    }}
                  >
                    {n.title}
                  </span>
                  {n.body && (
                    <span style={{ display: "block", fontSize: "0.8rem", color: "#64748b", marginTop: 2 }}>
                      {n.body}
                    </span>
                  )}
                  <span style={{ display: "block", fontSize: "0.72rem", color: "#a3aebf", marginTop: 4 }}>
                    {ago(n.createdAt)}
                  </span>
                </span>
                {!n.readAt && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: "#2563eb",
                      flexShrink: 0,
                      marginTop: 8,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
