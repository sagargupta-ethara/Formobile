"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  api,
  PageHeader,
  Skeleton,
  StatusBadge,
  PriorityBadge,
  Badge,
  ErrorText,
} from "@/components/ui";
import { fmtDateTime, fmtBytes, countdown } from "@/lib/format";

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
  createdAt: string;
  reviewer: { name: string } | null;
}
interface TaskDetail {
  id: string;
  status: string;
  priority: string;
  deadline: string | null;
  reviewDueAt: string | null;
  currentVersion: number;
  project: { id: string; name: string; code: string };
  floor: { floorName: string };
  category: { name: string };
  designer: { id: string; name: string; email: string } | null;
  files: FileRec[];
  reviews: ReviewRec[];
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [t, me] = await Promise.all([
        api<{ task: TaskDetail }>(`/api/tasks/${id}`),
        api<{ user: { role: string } }>("/api/auth/me"),
      ]);
      setTask(t.task);
      setRole(me.user?.role ?? "");
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
        title={task.category.name}
        subtitle={`${task.project.name} · ${task.floor.floorName}`}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
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

            {role === "DESIGNER" && task.status !== "APPROVED" && (
              <UploadBox taskId={task.id} onDone={load} status={task.status} />
            )}
          </div>

          {/* On-site review actions */}
          {role === "ONSITE" && isPending && (
            <ReviewBox taskId={task.id} version={task.currentVersion} onDone={load} />
          )}
        </div>

        {/* Side: review history + designer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card" style={{ padding: "1.2rem" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Assigned Designer</div>
            <div style={{ fontSize: "0.88rem" }}>{task.designer?.name ?? "Unassigned"}</div>
            {task.designer && (
              <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                {task.designer.email}
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
                    <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: 4 }}>
                      {r.reviewer?.name ?? "—"} · {fmtDateTime(r.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

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
        {status === "REJECTED" ? "Upload Revised Design" : "Upload Design"}
      </div>
      <ErrorText>{error}</ErrorText>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: "0.83rem" }}
        />
        <button className="btn btn-primary" disabled={!file || busy} onClick={upload}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      <p style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 6 }}>
        Accepted: PDF, DWG, DXF, PNG, JPG, ZIP · max 50 MB. A new version routes
        the design back to the on-site reviewer.
      </p>
    </div>
  );
}

function ReviewBox({
  taskId,
  version,
  onDone,
}: {
  taskId: string;
  version: number;
  onDone: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [comments, setComments] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && !comments.trim()) {
      setRejecting(true);
      setError("A reason is required to reject.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks/${taskId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: "1.2rem" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        Review Decision <span style={{ color: "#94a3b8", fontWeight: 400 }}>· V{version}</span>
      </div>
      <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: 12 }}>
        Approve to complete this design, or reject with a reason to send it back
        for revision.
      </p>
      <ErrorText>{error}</ErrorText>

      {(rejecting || comments) && (
        <textarea
          className="textarea"
          rows={3}
          placeholder="Reason for rejection (required)…"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          style={{ marginBottom: 10 }}
        />
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-success" disabled={busy} onClick={() => decide("APPROVED")}>
          Approve
        </button>
        {!rejecting ? (
          <button className="btn btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
            Reject
          </button>
        ) : (
          <button className="btn btn-danger" disabled={busy} onClick={() => decide("REJECTED")}>
            {busy ? "Submitting…" : "Confirm Rejection"}
          </button>
        )}
      </div>
    </div>
  );
}
