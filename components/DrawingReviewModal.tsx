"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Camera, FileText } from "lucide-react";
import { api, ErrorText } from "@/components/ui";
import VoiceRecorder, { recorderSupported } from "@/components/VoiceRecorder";
import { fmtBytes } from "@/lib/format";

interface FileRec {
  id: string;
  version: number;
  fileName: string;
  fileType: string;
  fileSize: number;
}
interface TaskInfo {
  id: string;
  status: string;
  currentVersion: number;
  category: { name: string };
  floor: { floorName: string };
  project: { name: string };
  reviewer: { id: string; name: string } | null;
  files: FileRec[];
}

const PREVIEWABLE = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif"]);

/**
 * On-site review modal: the drawing is shown first, and Approve / Reject (with
 * the rejection reason, voice memo and site photos) live inside the preview —
 * so a reviewer must open the drawing before deciding.
 */
export default function DrawingReviewModal({
  taskId,
  meId,
  onClose,
  onDone,
}: {
  taskId: string;
  meId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [task, setTask] = useState<TaskInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [mounted, setMounted] = useState(false);

  const [rejecting, setRejecting] = useState(false);
  const [comments, setComments] = useState("");
  const [voice, setVoice] = useState<File | null>(null);
  const [micFailed, setMicFailed] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    api<{ task: TaskInfo }>(`/api/tasks/${taskId}`)
      .then((d) => setTask(d.task))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load"));
  }, [taskId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const currentFile =
    task?.files.find((f) => f.version === task.currentVersion) ?? task?.files[0] ?? null;
  const ext = currentFile?.fileType.toLowerCase() ?? "";
  const canPreview = currentFile ? PREVIEWABLE.has(ext) : false;
  const isPending =
    !!task && (task.status === "PENDING_REVIEW" || task.status === "REVISION_SUBMITTED");
  const assignedToOther = !!task?.reviewer && task.reviewer.id !== meId;
  const canDecide = isPending && !assignedToOther;

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED") {
      if (!comments.trim()) {
        setRejecting(true);
        setError("A reason is required to reject.");
        return;
      }
      if (!voice && recorderSupported() && !micFailed) {
        setError("Please record a voice memo explaining the rejection.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("decision", decision);
      fd.append("comments", comments);
      if (decision === "REJECTED") {
        if (voice) fd.append("voice", voice);
        photos.slice(0, 5).forEach((p) => fd.append("photos", p));
      }
      const res = await fetch(`/api/tasks/${taskId}/reviews`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          padding: "1rem",
          zIndex: 95,
        }}
      >
        <motion.div
          key="panel"
          data-testid="drawing-review-modal"
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="card"
          style={{
            width: "100%",
            maxWidth: 1040,
            height: "90vh",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "1rem 1.3rem",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                {task ? task.category.name : "Loading…"}
              </div>
              {task && (
                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  {task.project.name} · {task.floor.floorName}
                  {currentFile ? ` · V${currentFile.version}` : ""}
                </div>
              )}
            </div>
            <button
              className="btn btn-ghost"
              data-testid="drawing-review-close"
              onClick={onClose}
              style={{ padding: "0.45rem 0.6rem" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* body: preview + decision */}
          <div className="drawing-review-body" style={{ flex: 1, minHeight: 0, display: "flex", flexWrap: "wrap" }}>
            {/* preview */}
            <div
              style={{
                flex: "1 1 420px",
                minWidth: 0,
                background: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {loadError ? (
                <p style={{ color: "#fca5a5", fontSize: "0.88rem", padding: "1rem" }}>{loadError}</p>
              ) : !currentFile ? (
                <p style={{ color: "#cbd5e1", fontSize: "0.88rem", padding: "1rem" }}>
                  No drawing available to review.
                </p>
              ) : canPreview ? (
                <iframe
                  data-testid="drawing-preview-frame"
                  title={currentFile.fileName}
                  src={`/api/files/${currentFile.id}`}
                  style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
                />
              ) : (
                <div style={{ textAlign: "center", color: "#cbd5e1", padding: "1.5rem" }}>
                  <FileText size={40} style={{ marginBottom: 10, opacity: 0.7 }} />
                  <div style={{ fontSize: "0.88rem", marginBottom: 4 }}>{currentFile.fileName}</div>
                  <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginBottom: 12 }}>
                    {ext.toUpperCase()} · {fmtBytes(currentFile.fileSize)}
                  </div>
                  <a
                    className="btn btn-primary"
                    href={`/api/files/${currentFile.id}?download=1`}
                    data-testid="drawing-download-link"
                  >
                    Download to view
                  </a>
                </div>
              )}
            </div>

            {/* decision panel */}
            <div
              style={{
                flex: "0 0 360px",
                maxWidth: "100%",
                borderLeft: "1px solid #f1f5f9",
                padding: "1.2rem 1.3rem",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 700 }}>Review Decision</div>

              {task && !isPending && (
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  No design is pending your review right now.
                </div>
              )}

              {isPending && assignedToOther && task && (
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  This review is assigned to <b>{task.reviewer?.name}</b>.
                </div>
              )}

              {canDecide && (
                <>
                  <p style={{ fontSize: "0.82rem", color: "#64748b", margin: 0 }}>
                    Review the drawing, then approve it, or reject with a written
                    reason and a recorded voice memo to send it back for revision.
                  </p>
                  <ErrorText>{error}</ErrorText>

                  {rejecting && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <textarea
                        className="textarea"
                        rows={3}
                        data-testid="reject-reason-input"
                        placeholder="Reason for rejection (required)…"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                      />
                      <VoiceRecorder
                        onChange={setVoice}
                        onUnavailable={() => {
                          setMicFailed(true);
                          setError("");
                        }}
                      />
                      <div>
                        <input
                          ref={photoRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.gif"
                          multiple
                          style={{ display: "none" }}
                          onChange={(e) =>
                            setPhotos(Array.from(e.target.files ?? []).slice(0, 5))
                          }
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => photoRef.current?.click()}
                          >
                            <Camera size={15} /> Attach site photos
                          </button>
                          <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                            optional · up to 5
                          </span>
                        </div>
                        {photos.length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                            {photos.map((p, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={URL.createObjectURL(p)}
                                alt={p.name}
                                title={`${p.name} — click to remove`}
                                onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                                style={{
                                  width: 52,
                                  height: 52,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border: "1px solid #e2e8f0",
                                  cursor: "pointer",
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                    {!rejecting ? (
                      <>
                        <button
                          className="btn btn-success"
                          data-testid="approve-btn"
                          disabled={busy || !currentFile}
                          onClick={() => decide("APPROVED")}
                        >
                          <Check size={15} /> Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          data-testid="reject-btn"
                          disabled={busy || !currentFile}
                          onClick={() => setRejecting(true)}
                        >
                          <X size={15} /> Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-danger"
                          data-testid="confirm-reject-btn"
                          disabled={busy}
                          onClick={() => decide("REJECTED")}
                        >
                          {busy ? "Submitting…" : "Confirm Rejection"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => {
                            setRejecting(false);
                            setError("");
                          }}
                        >
                          Back
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
