"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ArrowUpRight,
  Upload,
  Check,
  X,
  MousePointerClick,
  ArrowUpDown,
} from "lucide-react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  Badge,
  StatusBadge,
  PriorityBadge,
  ErrorText,
} from "@/components/ui";
import Building, { type BuildingFloor, type FloorMeta } from "@/components/Building";
import { EASE } from "@/components/motion";
import { PROJECT_STATUS_LABEL, fmtDate, fmtDateTime } from "@/lib/format";
import AssignTaskModal from "@/components/AssignTaskModal";

interface Project {
  id: string;
  name: string;
  code: string;
  clientName: string | null;
  location: string | null;
  status: string;
  startDate: string | null;
  expectedCompletion: string | null;
  floors: { id: string; floorName: string; order: number }[];
}
interface Task {
  id: string;
  status: string;
  priority: string;
  deadline: string | null;
  floorId: string;
  floor: { floorName: string };
  category: { name: string };
  designer: { name: string } | null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<string | null>(search.get("floor"));

  // open the requested floor when arriving from a task/review link
  useEffect(() => {
    const f = search.get("floor");
    if (f) setSelected(f);
  }, [search]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [newFloor, setNewFloor] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<BuildingFloor[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async () => {
    const [p, t, me] = await Promise.all([
      api<{ project: Project }>(`/api/projects/${id}`),
      api<{ tasks: Task[] }>(`/api/tasks?projectId=${id}`),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    setProject(p.project);
    setTasks(t.tasks);
    setRole(me.user?.role ?? "");
    setSelected((cur) => cur ?? p.project.floors.find((f) => /ground/i.test(f.floorName))?.id ?? p.project.floors[0]?.id ?? null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!project)
    return (
      <>
        <PageHeader title="Project" />
        <Skeleton />
      </>
    );

  const isAdmin = role === "ADMIN";

  // per-floor status meta for building indicators
  const meta: Record<string, FloorMeta> = {};
  for (const f of project.floors) meta[f.id] = { total: 0, pending: 0, approved: 0, rejected: 0 };
  for (const t of tasks) {
    const m = meta[t.floorId];
    if (!m) continue;
    m.total++;
    if (t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED") m.pending++;
    else if (t.status === "APPROVED") m.approved++;
    else if (t.status === "REJECTED") m.rejected++;
  }

  const floors: BuildingFloor[] = project.floors.map((f) => ({
    id: f.id,
    name: f.floorName,
    order: f.order,
  }));
  const topFirst = [...floors].sort((a, b) => b.order - a.order);
  const selectedFloor = project.floors.find((f) => f.id === selected) ?? null;
  const floorTasks = tasks.filter((t) => t.floorId === selected);

  async function addFloor() {
    if (!newFloor.trim()) return;
    await api(`/api/projects/${id}/floors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floorName: newFloor }),
    });
    setNewFloor("");
    load();
  }
  async function delFloor(fid: string) {
    if (!confirm("Delete this floor and its tasks?")) return;
    await api(`/api/floors/${fid}`, { method: "DELETE" });
    if (selected === fid) setSelected(null);
    load();
  }
  function startReorder() {
    setReorderList(topFirst);
    setReorderMode(true);
  }
  async function saveOrder() {
    setSavingOrder(true);
    try {
      const orderedIds = [...reorderList]
        .reverse()
        .map((f) => f.id!)
        .filter(Boolean);
      await api(`/api/projects/${id}/floors`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      setReorderMode(false);
      await load();
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${project.code}${project.clientName ? ` · ${project.clientName}` : ""}${
          project.location ? ` · ${project.location}` : ""
        }`}
        action={
          isAdmin && (
            <button className="btn btn-primary" onClick={() => setAssignOpen(true)}>
              <Plus /> Assign Task
            </button>
          )
        }
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Badge bg="#eef2f7" fg="#475569" dot>
          {PROJECT_STATUS_LABEL[project.status]}
        </Badge>
        <Badge bg="#f8fafc" fg="#64748b">Start {fmtDate(project.startDate)}</Badge>
        <Badge bg="#f8fafc" fg="#64748b">Due {fmtDate(project.expectedCompletion)}</Badge>
      </div>

      <div className="r-side-narrow">
        {/* ---------- Building ---------- */}
        <div className="card" style={{ padding: "1.4rem 1rem", height: "fit-content" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
              paddingLeft: 4,
            }}
          >
            <div style={{ fontWeight: 700 }}>Building</div>
            {isAdmin &&
              (reorderMode ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "0.4rem 0.6rem", fontSize: "0.78rem" }}
                    onClick={() => setReorderMode(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "0.4rem 0.6rem", fontSize: "0.78rem" }}
                    disabled={savingOrder}
                    onClick={saveOrder}
                  >
                    {savingOrder ? <span className="spinner" /> : <Check size={14} />} Save
                  </button>
                </div>
              ) : (
                project.floors.length > 1 && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "0.4rem 0.6rem", fontSize: "0.78rem" }}
                    onClick={startReorder}
                  >
                    <ArrowUpDown size={14} /> Reorder
                  </button>
                )
              ))}
          </div>
          <p style={{ fontSize: "0.76rem", color: "#94a3b8", marginBottom: 16, paddingLeft: 4 }}>
            {reorderMode
              ? "Drag floors to set their order, then Save."
              : isAdmin
              ? "Tap a floor to manage its design tasks."
              : role === "DESIGNER"
              ? "Tap a floor to add your designs."
              : "Tap a floor to review designs."}
          </p>

          {reorderMode ? (
            <Building floors={reorderList} reorderable onReorder={setReorderList} />
          ) : (
            <Building
              floors={floors}
              selectedId={selected}
              onSelect={(f) => setSelected(f.id ?? null)}
              meta={meta}
            />
          )}

          {isAdmin && !reorderMode && (
            <div style={{ marginTop: 18, display: "flex", gap: 6 }}>
              <input
                className="input"
                placeholder="Add a floor…"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFloor())}
              />
              <button className="btn btn-ghost" onClick={addFloor} type="button">
                <Plus size={15} />
              </button>
            </div>
          )}
        </div>

        {/* ---------- Floor panel ---------- */}
        <div>
          <AnimatePresence mode="wait">
            {!selectedFloor ? (
              <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Empty>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <MousePointerClick size={16} /> Select a floor to view its design tasks
                  </span>
                </Empty>
              </motion.div>
            ) : (
              <motion.div
                key={selectedFloor.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="card"
                style={{ padding: "1.4rem" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                      {selectedFloor.floorName}
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                      {floorTasks.length} design task{floorTasks.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {isAdmin && (
                      <>
                        <button
                          className="btn btn-ghost"
                          onClick={() => setAssignOpen(true)}
                          style={{ fontSize: "0.8rem" }}
                        >
                          <Plus size={15} /> Assign
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => delFloor(selectedFloor.id)}
                          title="Delete floor"
                          style={{ color: "#dc2626", padding: "0.5rem 0.6rem" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {floorTasks.length === 0 ? (
                  <Empty>
                    {isAdmin
                      ? "No tasks on this floor yet."
                      : role === "DESIGNER"
                      ? "No design tasks assigned to you here."
                      : "Nothing to review on this floor."}
                  </Empty>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {floorTasks.map((t) => (
                      <TaskActionRow key={t.id} task={t} role={role} onChanged={load} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {assignOpen && (
        <AssignTaskModal
          fixedProjectId={project.id}
          fixedFloorId={selectedFloor?.id}
          onClose={() => setAssignOpen(false)}
          onCreated={() => {
            setAssignOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}

/* ----- per-task row that adapts its actions to the viewer's role ----- */
function TaskActionRow({
  task,
  role,
  onChanged,
}: {
  task: Task;
  role: string;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const pending = task.status === "PENDING_REVIEW" || task.status === "REVISION_SUBMITTED";

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/tasks/${task.id}/files`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "REJECTED" && !reason.trim()) {
      setRejecting(true);
      setError("A reason is required to reject.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks/${task.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comments: reason }),
      });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <div style={{ border: "1px solid #e6ebf2", borderRadius: 10, padding: "0.8rem 0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: "0.9rem" }}>{task.category.name}</div>
          <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
            {task.designer?.name ?? "Unassigned"} · Due {fmtDateTime(task.deadline)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {/* ADMIN — view through to full task */}
        {role === "ADMIN" && (
          <Link href={`/tasks/${task.id}`} className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
            Manage <ArrowUpRight size={14} />
          </Link>
        )}

        {/* DESIGNER — add / revise the design inline */}
        {role === "DESIGNER" && (
          <>
            {task.status !== "APPROVED" && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.zip"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
                <button
                  className="btn btn-primary"
                  style={{ fontSize: "0.8rem" }}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {busy ? <span className="spinner" /> : <Upload size={14} />}
                  {task.status === "REJECTED" ? "Upload Revision" : "Add Design"}
                </button>
              </>
            )}
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
              View <ArrowUpRight size={14} />
            </Link>
          </>
        )}

        {/* ON-SITE — approve / reject inline */}
        {role === "ONSITE" && (
          <>
            {pending ? (
              <>
                {!rejecting ? (
                  <>
                    <button
                      className="btn btn-success"
                      style={{ fontSize: "0.8rem" }}
                      disabled={busy}
                      onClick={() => decide("APPROVED")}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: "0.8rem" }}
                      disabled={busy}
                      onClick={() => setRejecting(true)}
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                ) : (
                  <div style={{ width: "100%" }}>
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="Reason for rejection (required)…"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: "0.8rem" }}
                        disabled={busy}
                        onClick={() => decide("REJECTED")}
                      >
                        {busy ? <span className="spinner" /> : <X size={14} />} Confirm Rejection
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "0.8rem" }}
                        onClick={() => {
                          setRejecting(false);
                          setReason("");
                          setError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link href={`/tasks/${task.id}`} className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
                View <ArrowUpRight size={14} />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
