"use client";

import { useEffect, useState } from "react";
import { FileText, ImageIcon, ChevronDown, Eye, Download, Search } from "lucide-react";
import { api, Skeleton, Empty, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";

interface Version {
  id: string;
  version: number;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  url: string;
}
interface Drawing {
  taskId: string;
  name: string;
  discipline: string;
  floorName: string;
  status: string;
  versions: Version[];
}

const isImg = (n: string) => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(n);
const isPdf = (n: string) => /\.pdf$/i.test(n);

/** Project tab: every uploaded drawing grouped under its heading; expand to
 *  see and preview each version. Visible to admins and project members. */
export default function UploadedDrawingsTab({ projectId }: { projectId: string }) {
  const [drawings, setDrawings] = useState<Drawing[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<{ v: Version; name: string } | null>(null);

  useEffect(() => {
    api<{ drawings: Drawing[] }>(`/api/projects/${projectId}/uploads`)
      .then((d) => {
        setDrawings(d.drawings);
        setOpen(d.drawings[0]?.taskId ?? null);
      })
      .catch(() => setDrawings([]));
  }, [projectId]);

  if (!drawings) return <Skeleton rows={4} />;

  const shown = drawings.filter((d) =>
    d.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 9,
          padding: "0.4rem 0.7rem",
          maxWidth: 320,
        }}
      >
        <Search size={15} color="#94a3b8" />
        <input
          data-testid="uploaded-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search uploaded drawings…"
          style={{ border: "none", outline: "none", fontSize: "0.86rem", background: "transparent", width: "100%" }}
        />
      </div>

      {shown.length === 0 ? (
        <Empty>No drawings have been uploaded to this project yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shown.map((d) => {
            const isOpen = open === d.taskId;
            return (
              <div key={d.taskId} className="card" style={{ padding: 0, overflow: "hidden" }} data-testid={`uploaded-drawing-${d.taskId}`}>
                <button
                  onClick={() => setOpen(isOpen ? null : d.taskId)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    border: "none",
                    background: isOpen ? "#f8fafc" : "#fff",
                    padding: "0.85rem 1rem",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 700, color: "#1e293b", fontSize: "0.9rem" }}>
                      {d.name}
                    </span>
                    <span style={{ display: "block", fontSize: "0.76rem", color: "#94a3b8", marginTop: 2 }}>
                      {d.floorName} · {d.versions.length} version{d.versions.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <StatusBadge status={d.status} />
                    <ChevronDown
                      size={16}
                      color="#94a3b8"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div style={{ padding: "0.4rem 1rem 1rem", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {d.versions.map((v) => (
                      <button
                        key={v.id}
                        data-testid={`uploaded-version-${v.id}`}
                        onClick={() => setPreview({ v, name: d.name })}
                        title={v.fileName}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          border: "1px solid var(--color-line)",
                          background: "#fff",
                          borderRadius: 8,
                          padding: "0.35rem 0.6rem",
                          fontSize: "0.76rem",
                          fontWeight: 600,
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        {isImg(v.fileName) ? <ImageIcon size={13} /> : <FileText size={13} />}
                        V{v.version}
                        <Eye size={13} color="#1d4ed8" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={`${preview.name} · V${preview.v.version}`} wide>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: "0.76rem", color: "#94a3b8" }}>{preview.v.fileName}</span>
            <a className="btn btn-ghost" href={`${preview.v.url}?download=1`} style={{ padding: "0.35rem 0.7rem" }}>
              <Download size={14} /> Download
            </a>
          </div>
          <div style={{ background: "#0f172a", borderRadius: 10, minHeight: 360, display: "grid", placeItems: "center", overflow: "auto", maxHeight: "70vh" }}>
            {isImg(preview.v.fileName) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.v.url} alt={preview.v.fileName} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
            ) : isPdf(preview.v.fileName) ? (
              <iframe src={preview.v.url} title="preview" style={{ width: "100%", height: "70vh", border: "none", background: "#fff" }} />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "#cbd5e1" }}>
                <FileText size={40} style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: "0.85rem" }}>Preview not available. Uploaded {fmtDateTime(preview.v.uploadedAt)}.</p>
                <a className="btn btn-primary" href={`${preview.v.url}?download=1`} style={{ marginTop: 10 }}>
                  <Download size={15} /> Download file
                </a>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
