"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  Download,
  ChevronLeft,
  FolderOpen,
  FileText,
  ImageIcon,
  Eye,
  Layers,
} from "lucide-react";
import { api, PageHeader, Skeleton, Empty, Modal } from "@/components/ui";
import { PROJECT_STATUS_LABEL } from "@/lib/format";

interface Project {
  id: string;
  name: string;
  code: string;
  status: string;
  _count?: { floors?: number; tasks?: number };
}
interface Revision {
  id: string;
  version: number;
  fileName: string;
  createdAt: string;
  url: string;
}
interface Drawing {
  taskId: string;
  name: string;
  discipline: string;
  status: string;
  revisions: Revision[];
}
interface FloorNode {
  id: string;
  floorName: string;
  order: number;
  drawings: Drawing[];
  fileCount: number;
}

const isImg = (n: string) => /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(n);
const isPdf = (n: string) => /\.pdf$/i.test(n);

export default function ArchivePage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    api<{ projects: Project[] }>("/api/projects").then((d) => setProjects(d.projects));
  }, []);

  if (selected)
    return <ProjectArchive project={selected} onBack={() => setSelected(null)} />;

  const active = (projects ?? []).filter((p) => p.status !== "COMPLETED");
  const closed = (projects ?? []).filter((p) => p.status === "COMPLETED");

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Project Backups"
        subtitle="Browse and preview every drawing & revision. Completed projects are archived here automatically."
      />
      {!projects ? (
        <Skeleton rows={4} />
      ) : projects.length === 0 ? (
        <Empty>No projects yet.</Empty>
      ) : (
        <>
          <Section label="Active projects" projects={active} onOpen={setSelected} />
          <Section label="Archived (completed) projects" projects={closed} onOpen={setSelected} archived />
        </>
      )}
    </div>
  );
}

function Section({
  label,
  projects,
  onOpen,
  archived,
}: {
  label: string;
  projects: Project[];
  onOpen: (p: Project) => void;
  archived?: boolean;
}) {
  if (projects.length === 0) return null;
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 10 }}>
        {label} · {projects.length}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {projects.map((p) => (
          <button
            key={p.id}
            data-testid={`archive-project-${p.id}`}
            onClick={() => onOpen(p)}
            style={{
              textAlign: "left",
              border: "1px solid var(--color-line)",
              borderLeft: archived ? "4px solid #64748b" : "4px solid #1d4ed8",
              borderRadius: 12,
              background: "#fff",
              padding: "0.9rem 1rem",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderOpen size={16} color={archived ? "#64748b" : "#1d4ed8"} />
              <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#1e293b" }}>{p.name}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{p.code}</span>
              <span
                style={{
                  fontSize: "0.66rem",
                  fontWeight: 700,
                  padding: "0.12rem 0.5rem",
                  borderRadius: 999,
                  background: archived ? "#f1f5f9" : "#dbeafe",
                  color: archived ? "#475569" : "#1d4ed8",
                }}
              >
                {archived ? "Archived" : PROJECT_STATUS_LABEL[p.status] ?? p.status}
              </span>
              {p._count?.floors != null && (
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{p._count.floors} floors</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProjectArchive({ project, onBack }: { project: Project; onBack: () => void }) {
  const [floors, setFloors] = useState<FloorNode[] | null>(null);
  const [total, setTotal] = useState(0);
  const [openFloor, setOpenFloor] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ rev: Revision; drawing: string } | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ floors: FloorNode[]; totalFiles: number }>(
      `/api/projects/${project.id}/archive`
    );
    setFloors(d.floors);
    setTotal(d.totalFiles);
    setOpenFloor(d.floors.find((f) => f.fileCount > 0)?.id ?? d.floors[0]?.id ?? null);
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <button
        onClick={onBack}
        data-testid="archive-back"
        className="btn btn-ghost"
        style={{ marginBottom: 12, padding: "0.4rem 0.7rem" }}
      >
        <ChevronLeft size={15} /> All backups
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Archive size={20} />
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0 }}>{project.name}</h1>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "4px 0 0" }}>
            {project.code} · {total} file{total === 1 ? "" : "s"} across all revisions
          </p>
        </div>
        <a
          className="btn btn-primary"
          data-testid="archive-download-zip"
          href={`/api/projects/${project.id}/backup`}
        >
          <Download size={15} /> Download ZIP
        </a>
      </div>

      {!floors ? (
        <Skeleton rows={5} />
      ) : total === 0 ? (
        <Empty>No drawing files have been uploaded for this project yet.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {floors.map((f) => {
            const open = openFloor === f.id;
            return (
              <div key={f.id} className="card" style={{ padding: 0, overflow: "hidden" }} data-testid={`archive-floor-${f.id}`}>
                <button
                  onClick={() => setOpenFloor(open ? null : f.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    border: "none",
                    background: open ? "#f8fafc" : "#fff",
                    padding: "0.85rem 1rem",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: "#1e293b" }}>
                    <Layers size={15} color="#1d4ed8" /> {f.floorName}
                  </span>
                  <span className="mono" style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                    {f.fileCount} file{f.fileCount === 1 ? "" : "s"}
                  </span>
                </button>
                {open && (
                  <div style={{ padding: "0.4rem 1rem 1rem", display: "flex", flexDirection: "column", gap: 10 }}>
                    {f.drawings.filter((d) => d.revisions.length > 0).length === 0 && (
                      <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "6px 0 0" }}>No uploaded drawings on this floor.</p>
                    )}
                    {f.drawings
                      .filter((d) => d.revisions.length > 0)
                      .map((d) => (
                        <div key={d.taskId} style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                          <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1e293b", marginBottom: 6 }}>
                            {d.name}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {d.revisions.map((r) => (
                              <button
                                key={r.id}
                                data-testid={`archive-revision-${r.id}`}
                                onClick={() => setPreview({ rev: r, drawing: d.name })}
                                title={r.fileName}
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
                                {isImg(r.fileName) ? <ImageIcon size={13} /> : <FileText size={13} />}
                                v{r.version}
                                <Eye size={13} color="#1d4ed8" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={`${preview.drawing} · v${preview.rev.version}`} wide>
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: "0.76rem", color: "#94a3b8" }}>{preview.rev.fileName}</span>
            <a className="btn btn-ghost" href={preview.rev.url} download style={{ padding: "0.35rem 0.7rem" }}>
              <Download size={14} /> Download
            </a>
          </div>
          <div style={{ background: "#0f172a", borderRadius: 10, minHeight: 360, display: "grid", placeItems: "center", overflow: "auto", maxHeight: "70vh" }}>
            {isImg(preview.rev.fileName) ? (
              <img src={preview.rev.url} alt={preview.rev.fileName} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
            ) : isPdf(preview.rev.fileName) ? (
              <iframe src={preview.rev.url} title="preview" style={{ width: "100%", height: "70vh", border: "none", background: "#fff" }} />
            ) : (
              <div style={{ padding: 40, textAlign: "center", color: "#cbd5e1" }}>
                <FileText size={40} style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: "0.85rem" }}>Preview not available for this file type.</p>
                <a className="btn btn-primary" href={preview.rev.url} download style={{ marginTop: 10 }}>
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
