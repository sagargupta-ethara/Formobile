"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, Upload, X as XIcon, AlertTriangle, ListChecks, Clock } from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  ASSIGNED: { icon: <ListChecks size={14} />, color: "#1d4ed8", bg: "#dbeafe" },
  UPLOADED: { icon: <Upload size={14} />, color: "#6d28d9", bg: "#ede9fe" },
  REVISION: { icon: <Upload size={14} />, color: "#6d28d9", bg: "#ede9fe" },
  APPROVED: { icon: <Check size={14} />, color: "#15803d", bg: "#dcfce7" },
  REJECTED: { icon: <XIcon size={14} />, color: "#b91c1c", bg: "#fee2e2" },
  REVIEW_OVERDUE: { icon: <AlertTriangle size={14} />, color: "#b45309", bg: "#fef3c7" },
  DEADLINE: { icon: <Clock size={14} />, color: "#b45309", bg: "#fef3c7" },
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

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.notifications ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      /* offline — ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "PATCH", body: "{}" }).catch(() => {});
  }

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((xs) =>
        xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).catch(() => {});
    }
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{
          position: "relative",
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 999,
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          color: "#475569",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <Bell size={15} />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="mono"
            style={{
              position: "absolute",
              top: -4,
              right: -5,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "#dc2626",
              color: "#fff",
              fontSize: "0.62rem",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 2px 6px rgba(220,38,38,0.5)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="card"
            style={{
              position: "absolute",
              right: 0,
              top: 40,
              width: 340,
              maxWidth: "86vw",
              zIndex: 50,
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>Notifications</span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#2563eb",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {items.length === 0 && (
                <div
                  style={{
                    padding: "2.2rem 1rem",
                    textAlign: "center",
                    color: "#94a3b8",
                    fontSize: "0.84rem",
                  }}
                >
                  You're all caught up.
                </div>
              )}
              {items.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.ASSIGNED;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="row-link"
                    style={{
                      display: "flex",
                      gap: 10,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderBottom: "1px solid #f6f8fb",
                      background: n.readAt ? "transparent" : "#f0f6ff",
                      padding: "0.7rem 1rem",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9,
                        flexShrink: 0,
                        display: "grid",
                        placeItems: "center",
                        background: meta.bg,
                        color: meta.color,
                        marginTop: 2,
                      }}
                    >
                      {meta.icon}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          fontWeight: n.readAt ? 500 : 700,
                          color: "#1e293b",
                        }}
                      >
                        {n.title}
                      </span>
                      {n.body && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.76rem",
                            color: "#64748b",
                            marginTop: 1,
                          }}
                        >
                          {n.body}
                        </span>
                      )}
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "#a3aebf",
                          marginTop: 3,
                        }}
                      >
                        {ago(n.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
