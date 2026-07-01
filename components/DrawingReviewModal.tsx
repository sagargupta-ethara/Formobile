"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Camera, FileText, ZoomIn, ZoomOut, RotateCw, Maximize, Download, ExternalLink } from "lucide-react";
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
                <DrawingViewer file={currentFile} ext={ext} />
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
                        onTranscribed={(text) =>
                          setComments((c) => (c.trim() ? `${c.trim()} ${text}` : text))
                        }
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


/* ---------- zoomable / pannable drawing preview ---------- */
const IMG_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

const tbtnStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  color: "#e2e8f0",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
};

function TBtn({
  children,
  onClick,
  title,
  testid,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  testid: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{ ...tbtnStyle, opacity: disabled ? 0.35 : 1, cursor: disabled ? "default" : "pointer" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.18)", margin: "0 2px" }} />;
}

function DrawingViewer({ file, ext }: { file: FileRec; ext: string }) {
  const url = `/api/files/${file.id}`;
  const isImage = IMG_EXT.has(ext);
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const minScale = isImage ? 0.5 : 1;
  const maxScale = isImage ? 5 : 3;
  const clamp = (s: number) => Math.min(maxScale, Math.max(minScale, s));
  const zoomBy = (d: number) => setScale((s) => clamp(Math.round((s + d) * 100) / 100));
  const reset = () => {
    setScale(1);
    setRot(0);
    setPos({ x: 0, y: 0 });
  };

  function onWheel(e: React.WheelEvent) {
    if (!isImage) return;
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.2 : -0.2);
  }
  function onDown(e: React.MouseEvent) {
    if (!isImage || scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
    setDragging(true);
  }
  function onMove(e: React.MouseEvent) {
    if (!drag.current) return;
    setPos({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  }
  function onUp() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#0f172a" }}>
      {isImage ? (
        <div
          onWheel={onWheel}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onMouseLeave={onUp}
          onDoubleClick={() => (scale > 1 ? reset() : setScale(2))}
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            cursor: scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            data-testid="drawing-preview-image"
            src={url}
            alt={file.fileName}
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              userSelect: "none",
              transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale}) rotate(${rot}deg)`,
              transition: dragging ? "none" : "transform 0.15s ease",
            }}
          />
        </div>
      ) : (
        <div style={{ width: "100%", height: "100%", overflow: "auto", background: "#525659" }}>
          <iframe
            data-testid="drawing-preview-frame"
            title={file.fileName}
            src={url}
            style={{
              width: `${100 * scale}%`,
              height: `${100 * scale}%`,
              minHeight: "100%",
              border: "none",
              background: "#fff",
              display: "block",
            }}
          />
        </div>
      )}

      {/* floating toolbar */}
      <div
        data-testid="drawing-toolbar"
        style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "rgba(15,23,42,0.85)",
          backdropFilter: "blur(8px)",
          borderRadius: 999,
          padding: "6px 8px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <TBtn testid="zoom-out-btn" title="Zoom out" onClick={() => zoomBy(-0.25)} disabled={scale <= minScale}>
          <ZoomOut size={18} />
        </TBtn>
        <button
          type="button"
          data-testid="zoom-reset-btn"
          title="Reset zoom"
          onClick={reset}
          style={{
            color: "#e2e8f0",
            fontSize: "0.74rem",
            fontWeight: 700,
            minWidth: 46,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          {Math.round(scale * 100)}%
        </button>
        <TBtn testid="zoom-in-btn" title="Zoom in" onClick={() => zoomBy(0.25)} disabled={scale >= maxScale}>
          <ZoomIn size={18} />
        </TBtn>
        <Divider />
        {isImage && (
          <TBtn testid="rotate-btn" title="Rotate" onClick={() => setRot((r) => (r + 90) % 360)}>
            <RotateCw size={18} />
          </TBtn>
        )}
        <TBtn testid="fit-btn" title="Fit to screen" onClick={reset}>
          <Maximize size={17} />
        </TBtn>
        <Divider />
        <a data-testid="open-newtab-btn" href={url} target="_blank" rel="noreferrer" title="Open in new tab" style={tbtnStyle}>
          <ExternalLink size={17} />
        </a>
        <a data-testid="download-drawing-btn" href={`${url}?download=1`} title="Download" style={tbtnStyle}>
          <Download size={17} />
        </a>
      </div>
    </div>
  );
}
