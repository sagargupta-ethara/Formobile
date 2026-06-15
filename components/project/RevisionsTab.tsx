"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Check, X, Mic, Camera, RefreshCw } from "lucide-react";
import { api, Skeleton, Empty, Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

interface Event {
  id: string;
  kind: "UPLOAD" | "REVISION" | "APPROVED" | "REJECTED";
  taskId: string;
  drawing: string;
  floor: string;
  version: number;
  by: string;
  comments: string | null;
  hasVoice: boolean;
  photoCount: number;
  at: string;
}

const KIND_META: Record<Event["kind"], { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  UPLOAD: { label: "Uploaded", icon: <Upload size={13} />, color: "#1d4ed8", bg: "#dbeafe" },
  REVISION: { label: "Revision", icon: <RefreshCw size={13} />, color: "#6d28d9", bg: "#ede9fe" },
  APPROVED: { label: "Approved", icon: <Check size={13} />, color: "#15803d", bg: "#dcfce7" },
  REJECTED: { label: "Rejected", icon: <X size={13} />, color: "#b91c1c", bg: "#fee2e2" },
};

const FILTERS = ["ALL", "REVISION", "REJECTED", "APPROVED", "UPLOAD"] as const;

/** Every upload, revision and review decision in the project — click through
 *  to the task's full history. */
export default function RevisionsTab({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  useEffect(() => {
    api<{ events: Event[] }>(`/api/projects/${projectId}/revisions`)
      .then((d) => setEvents(d.events))
      .catch(() => setEvents([]));
  }, [projectId]);

  if (!events) return <Skeleton rows={4} />;

  const shown = events.filter((e) => filter === "ALL" || e.kind === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              border: "1px solid",
              borderColor: filter === f ? "#1e293b" : "var(--color-line)",
              background: filter === f ? "#1e293b" : "#fff",
              color: filter === f ? "#fff" : "#64748b",
              borderRadius: 999,
              padding: "0.3rem 0.75rem",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {f === "ALL" ? "All" : KIND_META[f as Event["kind"]].label + "s"}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Empty>No activity of this kind yet.</Empty>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {shown.map((e, i) => {
            const meta = KIND_META[e.kind];
            return (
              <button
                key={e.id}
                onClick={() => router.push(`/tasks/${e.taskId}`)}
                className="row-link"
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "0.85rem 1.1rem",
                  borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
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
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 650, fontSize: "0.88rem", color: "#1e293b" }}>
                      {e.drawing}
                    </span>
                    <Badge bg={meta.bg} fg={meta.color}>{meta.label}</Badge>
                    <span className="mono" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                      V{e.version}
                    </span>
                    {e.hasVoice && <Mic size={13} color="#b45309" />}
                    {e.photoCount > 0 && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "0.72rem", color: "#64748b" }}>
                        <Camera size={13} /> {e.photoCount}
                      </span>
                    )}
                  </span>
                  {e.comments && (
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        color: "#64748b",
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.comments}
                    </span>
                  )}
                  <span style={{ display: "block", fontSize: "0.72rem", color: "#a3aebf", marginTop: 3 }}>
                    {e.floor} · {e.by} · {fmtDateTime(e.at)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
