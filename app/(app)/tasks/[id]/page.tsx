"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  api,
  PageHeader,
  Skeleton,
  StatusBadge,
  Badge,
  ErrorText,
} from "@/components/ui";
import { fmtDateTime, fmtBytes, countdown } from "@/lib/format";
import TaskEditModal from "@/components/TaskEditModal";
import DrawingReviewModal from "@/components/DrawingReviewModal";
import { Mic, History, Pencil, Upload, Eye } from "lucide-react";

interface FileRec {
  id: string;
  version: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: { name: string } | null;
}
interface ReviewRec {
  id: string;
  version: number;
  decision: "APPROVED" | "REJECTED";
  comments: string | null;
  voiceNoteKey: string | null;
  createdAt: string;
  reviewer: { name: string } | null;
  photos: { id: string; fileName: string }[];
}
interface AuditRec {
  id: string;
  action: string;
  detail: string | null;
  timestamp: string;
  performedBy: { name: string } | null;
}
interface TaskDetail {
  id: string;
  status: string;
  deadline: string | null;
  reviewDueAt: string | null;
  currentVersion: number;
  project: { id: string; name: string; code: string };
  floor: { floorName: string };
  category: { name: string };
  designer: { id: string; name: string; email: string } | null;
  reviewer: { id: string; name: string; email: string } | null;
  assignees: { user: { id: string; name: string; email: string } }[];
  files: FileRec[];
  reviews: ReviewRec[];
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [role, setRole] = useState("");
  const [logs, setLogs] = useState<AuditRec[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState("");

  const [meId, setMeId] = useState("");
  const load = useCallback(async () => {
    try {
      const [t, me] = await Promise.all([
        api<{ task: TaskDetail }>(`/api/tasks/${id}`),
        api<{ user: { id: string; role: string } }>("/api/auth/me"),
      ]);
      setTask(t.task);
      setRole(me.user?.role ?? "");
      setMeId(me.user?.id ?? "");
      api<{ logs: AuditRec[] }>(`/api/tasks/${id}/audit`)
        .then((d) => setLogs(d.logs))
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p style={{ color: "#b91c1c" }}>{error}</p>;
  if (!task)
    return (
      <>
        <PageHeader title="Task" />
        <Skeleton />
      </>
    );

  const isPending =
    task.status === "PENDING_REVIEW" || task.status === "REVISION_SUBMITTED";
  const cd = isPending && task.reviewDueAt ? countdown(task.reviewDueAt) : null;
  // On-site reviewers see no files while awaiting a (new) upload.
  const awaitingUpload =
    role === "ONSITE" &&
    (task.status === "REJECTED" || task.status === "ASSIGNED");

  return (
    <>
      <PageHeader
        eyebrow="Design Task"
        title={task.category.name}
        subtitle={`${task.project.name} · ${task.floor.floorName}`}
        action={
          role === "ADMIN" && (
            <button className="btn btn-ghost" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> Edit Task
            </button>
          )
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <StatusBadge status={task.status} />
        <Badge bg="#f8fafc" fg="#64748b">Deadline {fmtDateTime(task.deadline)}</Badge>
        {cd && (
          <Badge bg={cd.overdue ? "#fee2e2" : "#fef3c7"} fg={cd.overdue ? "#b91c1c" : "#b45309"}>
            Review SLA {cd.text}
          </Badge>
        )}
      </div>

      <div className="r-detail">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Current design + versions */}
          <div className="card" style={{ padding: "1.2rem" }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>
              {role === "ONSITE" ? "Design for Review" : "Design Files"}
            </div>

            {awaitingUpload && (
              <div
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "0.8rem 1rem",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                }}
              >
                {task.status === "REJECTED"
                  ? "You rejected the previous version. It is no longer shown. The new revised design will appear here once the designer uploads it."
                  : "No design has been uploaded yet. It will appear here once the designer submits it."}
              </div>
            )}

            {!awaitingUpload && task.files.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: "0.88rem" }}>
                No files uploaded yet.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {task.files.map((f) => {
                const isCurrent = f.version === task.currentVersion;
                return (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "0.7rem 0.9rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      background: isCurrent ? "#f8fafc" : "#fff",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>
                          V{f.version}
                        </span>
                        {isCurrent && (
                          <Badge bg="#dbeafe" fg="#1d4ed8">Current</Badge>
                        )}
                        <span
                          style={{
                            fontSize: "0.85rem",
                            color: "#475569",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {f.fileName}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>
                        {f.fileType.toUpperCase()} · {fmtBytes(f.fileSize)} ·{" "}
                        {f.uploadedBy?.name ?? "—"} · {fmtDateTime(f.uploadedAt)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a
                        className="btn btn-ghost"
                        href={`/api/files/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                      <a className="btn btn-ghost" href={`/api/files/${f.id}?download=1`}>
                        Download
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {(role === "DESIGNER" ||
              task.designer?.id === meId ||
              task.assignees.some((a) => a.user.id === meId)) && (
                <UploadBox taskId={task.id} onDone={load} status={task.status} />
              )}
          </div>

          {/* On-site review actions — the assigned reviewer decides; if no
              dedicated reviewer is set, any routed on-site member may */}
          {/* On-site: all decisions happen inside the drawing preview — the
              reviewer must open the drawing to approve/reject or edit a
              previous outcome. */}
          {role === "ONSITE" && (!task.reviewer || task.reviewer.id === meId) && (
            <div
              className="card"
              style={{ padding: "1.2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>
                  {isPending ? "Ready for your review" : task.status === "APPROVED" ? "You approved this drawing" : task.status === "REJECTED" ? "You rejected this drawing" : "Review"}
                </div>
                <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "3px 0 0" }}>
                  {isPending
                    ? "Open the drawing to approve or reject it."
                    : "Opened by mistake? Open the drawing to edit the outcome."}
                </p>
              </div>
              <button
                className="btn btn-primary"
                data-testid="onsite-open-review-btn"
                onClick={() => setReviewOpen(true)}
                disabled={awaitingUpload && task.status === "REJECTED"}
              >
                <Eye size={15} /> {isPending ? "Open Drawing to Review" : "Open Drawing"}
              </button>
            </div>
          )}
          {role === "ONSITE" && isPending && task.reviewer && task.reviewer.id !== meId && (
            <div
              className="card"
              style={{ padding: "1rem 1.2rem", fontSize: "0.85rem", color: "#64748b" }}
            >
              This review is assigned to <b>{task.reviewer.name}</b>.
            </div>
          )}
        </div>

        {/* Side: review history + designer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: "1.2rem" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Uploads (Assigned To)</div>
            {(task.assignees.length
              ? task.assignees.map((a) => a.user)
              : task.designer
              ? [task.designer]
              : []
            ).map((u) => (
              <div key={u.id} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: "0.88rem" }}>{u.name}</div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{u.email}</div>
              </div>
            ))}
            {!task.assignees.length && !task.designer && (
              <div style={{ fontSize: "0.88rem", color: "#94a3b8" }}>Unassigned</div>
            )}
            <div style={{ fontWeight: 700, margin: "14px 0 6px" }}>Reviews (Off-Site)</div>
            <div style={{ fontSize: "0.88rem" }}>
              {task.reviewer?.name ?? "Any routed off-site member"}
            </div>
            {task.reviewer && (
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                {task.reviewer.email} · 24h to decide after each upload
              </div>
            )}
          </div>

          <div className="card" style={{ padding: "1.2rem" }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Review History</div>
            {task.reviews.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No reviews yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {task.reviews.map((r) => (
                  <div key={r.id} style={{ borderLeft: "3px solid #e2e8f0", paddingLeft: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge
                        bg={r.decision === "APPROVED" ? "#dcfce7" : "#fee2e2"}
                        fg={r.decision === "APPROVED" ? "#15803d" : "#b91c1c"}
                      >
                        {r.decision === "APPROVED" ? "Approved" : "Rejected"}
                      </Badge>
                      <span style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                        V{r.version}
                      </span>
                    </div>
                    {r.comments && (
                      <p style={{ fontSize: "0.83rem", marginTop: 5, color: "#334155" }}>
                        {r.comments}
                      </p>
                    )}
                    {r.voiceNoteKey && (
                      <div style={{ marginTop: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            color: "#64748b",
                            marginBottom: 4,
                          }}
                        >
                          <Mic size={12} /> Voice note
                        </div>
                        <audio
                          controls
                          preload="none"
                          src={`/api/reviews/${r.id}/voice`}
                          style={{ width: "100%", height: 34 }}
                        />
                      </div>
                    )}
                    {r.photos.length > 0 && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {r.photos.map((p) => (
                          <a
                            key={p.id}
                            href={`/api/review-photos/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={p.fileName}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/review-photos/${p.id}`}
                              alt={p.fileName}
                              style={{
                                width: 54,
                                height: 54,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                              }}
                            />
                          </a>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: 4 }}>
                      {r.reviewer?.name ?? "—"} · {fmtDateTime(r.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Immutable activity trail (Module 12) — hidden from On-Site */}
          {role !== "ONSITE" && (
          <div className="card" style={{ padding: "1.2rem" }}>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              <History size={15} color="#64748b" /> Activity
            </div>
            {logs.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No activity yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {logs.map((l, i) => (
                  <div key={l.id} style={{ display: "flex", gap: 10 }}>
                    {/* timeline gutter */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          marginTop: 5,
                          flexShrink: 0,
                          background: AUDIT_COLOR[l.action] ?? "#cbd5e1",
                          boxShadow: `0 0 0 3px ${(AUDIT_COLOR[l.action] ?? "#cbd5e1")}22`,
                        }}
                      />
                      {i < logs.length - 1 && (
                        <span style={{ width: 1.5, flex: 1, background: "#eef2f7", margin: "4px 0" }} />
                      )}
                    </div>
                    <div style={{ paddingBottom: i < logs.length - 1 ? 14 : 0, minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
                        {AUDIT_LABEL[l.action] ?? l.action}
                      </div>
                      {l.detail && (
                        <div
                          style={{
                            fontSize: "0.76rem",
                            color: "#64748b",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {l.detail}
                        </div>
                      )}
                      <div style={{ fontSize: "0.71rem", color: "#94a3b8", marginTop: 2 }}>
                        {l.performedBy?.name ?? "System"} · {fmtDateTime(l.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {editOpen && (
        <TaskEditModal
          taskId={task.id}
          current={{
            designerIds: task.assignees.length ? task.assignees.map((a) => a.user.id) : task.designer ? [task.designer.id] : [],
            reviewerId: task.reviewer?.id,
            deadline: task.deadline,
            title: `Edit — ${task.category.name}`,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            load();
          }}
        />
      )}
      {reviewOpen && (
        <DrawingReviewModal
          taskId={task.id}
          meId={meId}
          onClose={() => setReviewOpen(false)}
          onDone={load}
        />
      )}
    </>
  );
}

const AUDIT_LABEL: Record<string, string> = {
  TASK_ASSIGNED: "Designer assigned",
  DESIGN_UPLOADED: "Design uploaded",
  REVISION_SUBMITTED: "Revision uploaded",
  DESIGN_APPROVED: "Approved",
  DESIGN_REJECTED: "Rejected",
  VOICE_NOTE_ADDED: "Voice note added",
  REVIEW_OVERDUE: "Review SLA expired",
};
const AUDIT_COLOR: Record<string, string> = {
  TASK_ASSIGNED: "#3b82f6",
  DESIGN_UPLOADED: "#6366f1",
  REVISION_SUBMITTED: "#6366f1",
  DESIGN_APPROVED: "#16a34a",
  DESIGN_REJECTED: "#dc2626",
  VOICE_NOTE_ADDED: "#d97706",
  REVIEW_OVERDUE: "#b91c1c",
};

function UploadBox({
  taskId,
  status,
  onDone,
}: {
  taskId: string;
  status: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tasks/${taskId}/files`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid #f1f5f9",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: 8 }}>
        {status === "REJECTED"
          ? "Upload Revised Design"
          : status === "APPROVED"
          ? "Replace Approved Design"
          : "Upload Design"}
      </div>
      <ErrorText>{error}</ErrorText>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <button
          type="button"
          data-testid="choose-file-btn"
          onClick={() => inputRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "1 1 260px",
            minWidth: 220,
            cursor: "pointer",
            border: "2px dashed",
            borderColor: file ? "#1d4ed8" : "#93b4e6",
            background: file ? "#eff6ff" : "#f8fbff",
            borderRadius: 12,
            padding: "0.85rem 1rem",
            textAlign: "left",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg,#3b82f6,#1e3a8a)",
              color: "#fff",
            }}
          >
            <Upload size={18} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontWeight: 700, fontSize: "0.88rem", color: "#1e293b" }}>
              {file ? file.name : "Click to choose a drawing file"}
            </span>
            <span style={{ display: "block", fontSize: "0.74rem", color: "#64748b", marginTop: 1 }}>
              {file ? fmtBytes(file.size) : "PDF, DWG, DXF, PNG, JPG or ZIP · up to 50 MB"}
            </span>
          </span>
        </button>
        <button
          className="btn btn-primary"
          data-testid="upload-file-btn"
          disabled={!file || busy}
          onClick={upload}
          style={{ cursor: !file || busy ? "not-allowed" : "pointer" }}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      <p style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 8 }}>
        A new version routes the design back to the on-site reviewer.
      </p>
    </div>
  );
}
