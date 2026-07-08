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
  Download,
  Check,
  MousePointerClick,
  ArrowUpDown,
  Pencil,
  Building2,
  AlertTriangle,
  BarChart3,
  Users,
  History,
  Settings2,
  RotateCcw,
} from "lucide-react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  Badge,
  StatusBadge,
  ErrorText,
  TaskPeople,
} from "@/components/ui";
import Building, { type BuildingFloor, type FloorMeta } from "@/components/Building";
import { EASE } from "@/components/motion";
import { PROJECT_STATUS_LABEL } from "@/lib/format";
import AssignTaskModal from "@/components/AssignTaskModal";
import TaskEditModal from "@/components/TaskEditModal";
import EditProjectModal from "@/components/EditProjectModal";
import DrawingReviewModal from "@/components/DrawingReviewModal";
import AnalyticsTab from "@/components/project/AnalyticsTab";
import TeamTab from "@/components/project/TeamTab";
import RevisionsTab from "@/components/project/RevisionsTab";
import RegisterTab from "@/components/project/RegisterTab";
import DesignerRegisterTab from "@/components/project/DesignerRegisterTab";
import UploadedDrawingsTab from "@/components/project/UploadedDrawingsTab";
import DesignerAnalyticsTab from "@/components/project/DesignerAnalyticsTab";
import OnSiteProjectBoard from "@/components/onsite/OnSiteProjectBoard";

interface Project {
  id: string;
  name: string;
  code: string;
  location: string | null;
  status: string;
  floors: { id: string; floorName: string; floorType: string; order: number }[];
}
interface Task {
  id: string;
  status: string;
  deadline: string | null;
  reviewDueAt?: string | null;
  floorId: string;
  designerId?: string | null;
  floor: { floorName: string };
  category: { id: string; name: string; discipline?: string };
  designer: { id?: string; name: string } | null;
  reviewer?: { id: string; name: string } | null;
  assignees?: { user: { id: string; name: string } }[];
}
interface Category {
  id: string;
  name: string;
  appliesTo: string[];
  floorIds: string[];
  discipline: string;
}

const DISCIPLINES = [
  { key: "INTERIOR", label: "Interior Design" },
  { key: "STRUCTURE", label: "Architecture" },
  { key: "MEP", label: "MEP" },
  { key: "WOODWORK", label: "Woodwork" },
] as const;

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const TABS = [
  { key: "BUILDING", label: "Building", icon: <Building2 size={15} />, roles: ["ADMIN", "DESIGNER"] },
  { key: "REGISTER_VIEW", label: "Drawing Register", icon: <Settings2 size={15} />, roles: ["DESIGNER"] },
  { key: "UPLOADED", label: "Uploaded Drawings", icon: <Upload size={15} />, roles: ["ADMIN", "DESIGNER"] },
  { key: "BREACHES", label: "Breach Timeline", icon: <AlertTriangle size={15} />, roles: ["ADMIN"] },
  { key: "ANALYTICS", label: "Analytics", icon: <BarChart3 size={15} />, roles: ["ADMIN", "DESIGNER"] },
  { key: "TEAM", label: "Team", icon: <Users size={15} />, roles: ["ADMIN", "DESIGNER"] },
  { key: "REVISIONS", label: "Revisions", icon: <History size={15} />, roles: ["ADMIN"] },
  { key: "SETTINGS", label: "Drawing Register", icon: <Settings2 size={15} />, roles: ["ADMIN"] },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [role, setRole] = useState("");
  const [meId, setMeId] = useState("");
  const [tab, setTab] = useState<TabKey>("BUILDING");
  const [selected, setSelected] = useState<string | null>(search.get("floor"));

  // open the requested floor when arriving from a task/review link
  useEffect(() => {
    const f = search.get("floor");
    if (f) {
      setSelected(f);
      setTab("BUILDING");
    }
  }, [search]);
  const [assign, setAssign] = useState<{ floorId?: string; categoryId?: string; categoryIds?: string[] } | null>(null);
  const [disc, setDisc] = useState<string>("INTERIOR");
  const [editProject, setEditProject] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<BuildingFloor[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const load = useCallback(async () => {
    const [p, t, me, c] = await Promise.all([
      api<{ project: Project }>(`/api/projects/${id}`),
      api<{ tasks: Task[] }>(`/api/tasks?projectId=${id}`),
      api<{ user: { id: string; role: string } }>("/api/auth/me"),
      api<{ categories: Category[] }>(`/api/categories?projectId=${id}`),
    ]);
    setProject(p.project);
    setTasks(t.tasks);
    setRole(me.user?.role ?? "");
    setMeId(me.user?.id ?? "");
    setCats(c.categories);
    setSelected(
      (cur) =>
        cur ??
        p.project.floors.find((f) => /ground/i.test(f.floorName))?.id ??
        p.project.floors[0]?.id ??
        null
    );
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

  // On-site reviewers get the simplified "Drawing List" experience
  // (floors → departments → drawings → full-screen preview/approve).
  if (role === "ONSITE") {
    return (
      <OnSiteProjectBoard
        project={project}
        tasks={tasks}
        meId={meId}
        onReload={load}
      />
    );
  }

  const isAdmin = role === "ADMIN";
  const isDesigner = role === "DESIGNER";

  async function selfAssign(categoryId: string) {
    if (!selectedFloor) return;
    try {
      await api("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: id,
          floorId: selectedFloor.id,
          categoryIds: [categoryId],
          designerIds: [meId],
        }),
      });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to self-assign");
    }
  }

  // per-floor status meta for building indicators
  const meta: Record<string, FloorMeta> = {};
  for (const f of project.floors)
    meta[f.id] = { total: 0, pending: 0, approved: 0, rejected: 0, assigned: 0 };
  for (const t of tasks) {
    const m = meta[t.floorId];
    if (!m) continue;
    m.total++;
    if (t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED") m.pending++;
    else if (t.status === "APPROVED") m.approved++;
    else if (t.status === "REJECTED") m.rejected++;
    else if (t.status === "ASSIGNED") m.assigned = (m.assigned ?? 0) + 1;
  }

  const floors: BuildingFloor[] = project.floors.map((f) => ({
    id: f.id,
    name: f.floorName,
    order: f.order,
    kind: f.floorType as BuildingFloor["kind"],
  }));
  const topFirst = [...floors].sort((a, b) => b.order - a.order);
  const selectedFloor = project.floors.find((f) => f.id === selected) ?? null;
  const floorTasks = tasks.filter((t) => t.floorId === selected);
  // the register for the selected floor (its own per-floor drawing list)
  const floorCats = selectedFloor
    ? cats.filter((c) => c.floorIds?.includes(selectedFloor.id))
    : [];
  // Designers only see their OWN tasks in the building view; the full register
  // + self-assignment lives in the dedicated Drawing Register tab.
  const shownFloorTasks = isDesigner
    ? floorTasks.filter(
        (t) =>
          t.designerId === meId ||
          (t.assignees?.some((a) => a.user.id === meId) ?? false)
      )
    : floorTasks;
  // department head-tab counts for this floor
  const discCount = (d: string) =>
    isAdmin
      ? floorCats.filter((c) => c.discipline === d).length
      : shownFloorTasks.filter((t) => t.category.discipline === d).length;
  const discCats = floorCats.filter((c) => c.discipline === disc);
  const discTasks = shownFloorTasks.filter((t) => t.category.discipline === disc);

  async function addLevel(type: "FLOOR" | "BASEMENT" | "STILT" | "TERRACE") {
    if (!project) return;
    const bottomUp = [...project.floors].sort((a, b) => a.order - b.order);
    const count = (t: string) => bottomUp.filter((f) => f.floorType === t).length;

    let floorName = "";
    let insertAt = bottomUp.length;
    if (type === "BASEMENT") {
      const n = count("BASEMENT");
      floorName = n === 0 ? "Basement" : `Basement ${n + 1}`;
      insertAt = 0;
    } else if (type === "STILT") {
      floorName = "Stilt Floor";
      insertAt = count("BASEMENT");
    } else if (type === "FLOOR") {
      const n = count("FLOOR");
      floorName = n === 0 ? "Ground Floor" : `${ordinal(n)} Floor`;
      insertAt = count("BASEMENT") + count("STILT") + n;
    } else {
      floorName = "Terrace";
      insertAt = bottomUp.length;
    }

    const created = await api<{ floor: { id: string } }>(
      `/api/projects/${id}/floors`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorName, floorType: type }),
      }
    );
    const orderedIds = bottomUp.map((f) => f.id);
    orderedIds.splice(insertAt, 0, created.floor.id);
    await api(`/api/projects/${id}/floors`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
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
        eyebrow={`Project · ${project.code}`}
        title={project.name}
        subtitle={[PROJECT_STATUS_LABEL[project.status], project.location]
          .filter(Boolean)
          .join(" · ")}
        action={
          isAdmin && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => setEditProject(true)}>
                <Pencil size={15} /> Edit Project
              </button>
              <a
                className="btn btn-ghost"
                data-testid="backup-drawings-btn"
                href={`/api/projects/${project.id}/backup`}
                title="Download all drawing files as a ZIP"
              >
                <Download size={15} /> Backup Drawings
              </a>
              <button
                className="btn btn-primary"
                onClick={() => setAssign({ floorId: selectedFloor?.id })}
              >
                <Plus /> Assign Task
              </button>
            </div>
          )
        }
      />

      {/* ------- tabs (everyone sees Building + Team; the rest are admin) ------- */}
      <div
        style={{
          display: "inline-flex",
          gap: 2,
          marginBottom: 18,
          padding: 4,
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 12,
          boxShadow: "var(--shadow-sm)",
          flexWrap: "wrap",
        }}
      >
        {(isAdmin ? TABS : TABS.filter((t) => (t.roles as readonly string[]).includes(role))).map(
          (t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  position: "relative",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "0.45rem 0.85rem",
                  borderRadius: 9,
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: active ? "#fff" : "#64748b",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {active && (
                  <motion.span
                    layoutId="project-tab"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 9,
                      background: "linear-gradient(180deg, #1e293b, #0f172a)",
                      zIndex: 0,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {t.icon} {t.label}
                </span>
              </button>
            );
          }
        )}
      </div>

      {tab === "ANALYTICS" &&
        (isAdmin ? (
          <AnalyticsTab projectId={project.id} />
        ) : (
          <DesignerAnalyticsTab projectId={project.id} />
        ))}
      {isAdmin && tab === "BREACHES" && <BreachTimeline tasks={tasks} />}
      {tab === "TEAM" && <TeamTab projectId={project.id} isAdmin={isAdmin} />}
      {tab === "UPLOADED" && <UploadedDrawingsTab projectId={project.id} />}
      {isDesigner && tab === "REGISTER_VIEW" && (
        <DesignerRegisterTab
          projectId={project.id}
          floors={project.floors}
          cats={cats}
          tasks={tasks}
          meId={meId}
          onReload={load}
        />
      )}
      {isAdmin && tab === "REVISIONS" && <RevisionsTab projectId={project.id} />}
      {isAdmin && tab === "SETTINGS" && <RegisterTab projectId={project.id} isAdmin />}

      {tab === "BUILDING" && (
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
                ? "Tap a floor to see its drawing register."
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
              <div style={{ marginTop: 18 }}>
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                    marginBottom: 8,
                  }}
                >
                  Add a level
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" type="button" onClick={() => addLevel("FLOOR")}>
                    <Plus size={14} /> Floor
                  </button>
                  <button className="btn btn-ghost" type="button" onClick={() => addLevel("BASEMENT")}>
                    <Plus size={14} /> Basement
                  </button>
                  {(() => {
                    const hasStilt = project.floors.some((f) => f.floorType === "STILT");
                    const hasTerrace = project.floors.some((f) => f.floorType === "TERRACE");
                    return (
                      <>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={hasStilt}
                          onClick={() => addLevel("STILT")}
                        >
                          {hasStilt ? <Check size={14} color="#16a34a" /> : <Plus size={14} />}
                          {hasStilt ? "Stilt added" : "Stilt"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          type="button"
                          disabled={hasTerrace}
                          onClick={() => addLevel("TERRACE")}
                        >
                          {hasTerrace ? <Check size={14} color="#16a34a" /> : <Plus size={14} />}
                          {hasTerrace ? "Terrace added" : "Terrace"}
                        </button>
                      </>
                    );
                  })()}
                </div>
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
                      <MousePointerClick size={16} /> Select a floor to view its drawings
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
                        {isAdmin
                          ? `${floorTasks.length} of ${floorCats.length} drawings assigned`
                          : `${floorTasks.length} design task${floorTasks.length === 1 ? "" : "s"}`}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => delFloor(selectedFloor.id)}
                        title="Delete floor"
                        style={{ color: "#dc2626", padding: "0.5rem 0.6rem" }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  {/* department head-tabs */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                    {DISCIPLINES.map((d) => {
                      const n = discCount(d.key);
                      const active = disc === d.key;
                      return (
                        <button
                          key={d.key}
                          onClick={() => setDisc(d.key)}
                          style={{
                            border: "1px solid",
                            borderColor: active ? "#1e293b" : "var(--color-line)",
                            background: active ? "#1e293b" : "#fff",
                            color: active ? "#fff" : n > 0 ? "#475569" : "#b3bfd0",
                            borderRadius: 999,
                            padding: "0.32rem 0.75rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          {d.label}
                          <span
                            className="mono"
                            style={{
                              fontSize: "0.66rem",
                              padding: "0.05rem 0.4rem",
                              borderRadius: 999,
                              background: active ? "rgba(255,255,255,0.18)" : "#f1f5f9",
                            }}
                          >
                            {n}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isAdmin ? (
                    <FloorRegister
                      cats={discCats}
                      tasks={floorTasks}
                      mode="admin"
                      onAssign={(categoryId) =>
                        setAssign({ floorId: selectedFloor.id, categoryId })
                      }
                      onBulkAssign={(categoryIds) =>
                        setAssign({ floorId: selectedFloor.id, categoryIds })
                      }
                      onSelfAssign={selfAssign}
                      onEdit={(t) => setEditTask(t)}
                    />
                  ) : discTasks.length === 0 ? (
                    <Empty>
                      {role === "DESIGNER"
                        ? "No design tasks assigned to you in this department. Use the Drawing Register tab to pick one up."
                        : "Nothing to review here."}
                    </Empty>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {discTasks.map((t) => (
                        <TaskActionRow key={t.id} task={t} role={role} meId={meId} onChanged={load} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {assign && (
        <AssignTaskModal
          fixedProjectId={project.id}
          fixedFloorId={assign.floorId}
          fixedCategoryId={assign.categoryId}
          fixedCategoryIds={assign.categoryIds}
          onClose={() => setAssign(null)}
          onCreated={() => {
            setAssign(null);
            load();
          }}
        />
      )}
      {editProject && (
        <EditProjectModal
          project={{
            id: project.id,
            name: project.name,
            code: project.code,
            location: project.location,
            status: project.status,
          }}
          onClose={() => setEditProject(false)}
          onSaved={() => {
            setEditProject(false);
            load();
          }}
          onDeleted={() => {
            window.location.href = "/projects";
          }}
        />
      )}
      {editTask && (
        <TaskEditModal
          taskId={editTask.id}
          current={{
            designerIds: editTask.assignees?.map((a) => a.user.id) ?? (editTask.designer?.id ? [editTask.designer.id] : []),
            reviewerId: editTask.reviewer?.id,
            deadline: editTask.deadline,
            title: `Edit — ${editTask.category.name}`,
          }}
          onClose={() => setEditTask(null)}
          onSaved={() => {
            setEditTask(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ----- project-level breach timeline (SLA + deadline misses) ----- */
function BreachTimeline({ tasks }: { tasks: Task[] }) {
  const now = Date.now();
  type Breach = {
    id: string;
    kind: "REVIEW" | "DEADLINE";
    at: number;
    task: Task;
  };
  const breaches: Breach[] = [];
  for (const t of tasks) {
    const pending = t.status === "PENDING_REVIEW" || t.status === "REVISION_SUBMITTED";
    if (pending && t.reviewDueAt && new Date(t.reviewDueAt).getTime() < now) {
      breaches.push({ id: `${t.id}-r`, kind: "REVIEW", at: new Date(t.reviewDueAt).getTime(), task: t });
    }
    if (t.deadline && t.status !== "APPROVED" && new Date(t.deadline).getTime() < now) {
      breaches.push({ id: `${t.id}-d`, kind: "DEADLINE", at: new Date(t.deadline).getTime(), task: t });
    }
  }
  breaches.sort((a, b) => a.at - b.at); // oldest breach first

  function lateBy(ms: number): string {
    const h = Math.floor((now - ms) / 3_600_000);
    if (h < 24) return `${Math.max(1, h)}h late`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h late`;
  }

  return (
    <div className="card" style={{ padding: "1.2rem" }} data-testid="breach-timeline">
      <div style={{ fontWeight: 700 }}>
        Breach Timeline
        <span className="mono" style={{ fontWeight: 500, color: "#94a3b8", fontSize: "0.78rem", marginLeft: 8 }}>
          {breaches.length}
        </span>
      </div>
      <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "2px 0 14px" }}>
        Tasks that missed their 24h review SLA or their design deadline, oldest first.
      </p>
      {breaches.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#15803d", fontSize: "0.86rem", fontWeight: 600 }}>
          <Check size={16} /> No breaches — everything is on track.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {breaches.map((b) => (
            <Link
              key={b.id}
              href={`/tasks/${b.task.id}`}
              data-testid={`breach-row-${b.task.id}`}
              className="row-link"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "0.7rem 0.85rem",
                borderRadius: 10,
                border: "1px solid #fee2e2",
                background: "#fff",
                borderLeft: "4px solid #dc2626",
              }}
            >
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  padding: "0.2rem 0.5rem",
                  borderRadius: 999,
                  background: b.kind === "REVIEW" ? "#fef3c7" : "#fee2e2",
                  color: b.kind === "REVIEW" ? "#b45309" : "#b91c1c",
                  flexShrink: 0,
                }}
              >
                {b.kind === "REVIEW" ? "REVIEW SLA" : "DEADLINE"}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: "0.86rem", fontWeight: 700, color: "#1e293b" }}>
                  {b.task.category.name}
                </span>
                <span style={{ display: "block", fontSize: "0.75rem", color: "#94a3b8" }}>
                  {b.task.floor.floorName}
                  {b.task.designer ? ` · ${b.task.designer.name}` : ""}
                  {b.task.reviewer ? ` · reviewer ${b.task.reviewer.name}` : ""}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#dc2626" }}>
                  {lateBy(b.at)}
                </span>
                <StatusBadge status={b.task.status} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----- admin/designer floor view: the full drawing register ----- */
function FloorRegister({
  cats,
  tasks,
  mode,
  onAssign,
  onBulkAssign,
  onSelfAssign,
  onEdit,
}: {
  cats: Category[];
  tasks: Task[];
  mode: "admin" | "designer";
  onAssign: (categoryId: string) => void;
  onBulkAssign: (categoryIds: string[]) => void;
  onSelfAssign: (categoryId: string) => void;
  onEdit: (t: Task) => void;
}) {
  const isAdmin = mode === "admin";
  const [q, setQ] = useState(""); // quick filter — registers run 18–41 drawings
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const taskByCat = new Map<string, Task>();
  for (const t of tasks) taskByCat.set(t.category.id, t);

  const shown = cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  function toggleSel(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <input
        className="input"
        placeholder="Filter drawings…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      {isAdmin && selected.size > 0 && (
        <div
          data-testid="bulk-assign-bar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 10,
            padding: "0.55rem 0.8rem",
            borderRadius: 9,
            background: "#1e293b",
            color: "#fff",
          }}
        >
          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
            {selected.size} drawing{selected.size === 1 ? "" : "s"} selected
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.76rem", padding: "0.32rem 0.6rem", background: "rgba(255,255,255,0.12)", color: "#fff", border: "none" }}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
            <button
              className="btn btn-primary"
              data-testid="bulk-assign-confirm"
              style={{ fontSize: "0.76rem", padding: "0.32rem 0.7rem" }}
              onClick={() => onBulkAssign([...selected])}
            >
              <Plus size={13} /> Assign selected
            </button>
          </span>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflowY: "auto", paddingRight: 4 }}>
        {shown.map((c) => {
          const t = taskByCat.get(c.id);
          const checked = selected.has(c.id);
          return (
            <div
              key={c.id}
              data-testid={`floor-register-row-${c.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.55rem 0.7rem",
                border: "1px solid",
                borderColor: checked ? "#1d4ed8" : "#eef2f7",
                borderRadius: 9,
                background: checked ? "#eff6ff" : t ? "#fff" : "#fafcfe",
              }}
            >
              {isAdmin && !t && (
                <input
                  type="checkbox"
                  data-testid={`bulk-select-${c.id}`}
                  checked={checked}
                  onChange={() => toggleSel(c.id)}
                  style={{ width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: t ? "#1e293b" : "#64748b" }}>
                  {c.name}
                </div>
                {t && (
                  <TaskPeople
                    assignees={
                      t.assignees?.length
                        ? t.assignees.map((a) => a.user.name)
                        : t.designer
                        ? [t.designer.name]
                        : []
                    }
                    reviewer={t.reviewer?.name ?? null}
                    deadline={t.deadline}
                  />
                )}
              </div>
              {t ? (
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <StatusBadge status={t.status} />
                  {isAdmin && (
                    <button
                      onClick={() => onEdit(t)}
                      title="Edit task"
                      style={{
                        border: "1px solid var(--color-line)",
                        background: "#fff",
                        borderRadius: 7,
                        width: 27,
                        height: 27,
                        display: "grid",
                        placeItems: "center",
                        cursor: "pointer",
                        color: "#64748b",
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <Link
                    href={`/tasks/${t.id}`}
                    title="Open task"
                    style={{
                      border: "1px solid var(--color-line)",
                      background: "#fff",
                      borderRadius: 7,
                      width: 27,
                      height: 27,
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                    }}
                  >
                    <ArrowUpRight size={13} />
                  </Link>
                </span>
              ) : isAdmin ? (
                <button
                  className="btn btn-ghost"
                  data-testid={`assign-btn-${c.id}`}
                  disabled={selected.size > 0}
                  title={selected.size > 0 ? "Finish bulk assignment first" : "Assign this drawing"}
                  style={{
                    fontSize: "0.76rem",
                    padding: "0.38rem 0.7rem",
                    flexShrink: 0,
                    opacity: selected.size > 0 ? 0.4 : 1,
                    cursor: selected.size > 0 ? "not-allowed" : "pointer",
                    pointerEvents: selected.size > 0 ? "none" : "auto",
                  }}
                  onClick={() => onAssign(c.id)}
                >
                  <Plus size={13} /> Assign
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  data-testid={`self-assign-${c.id}`}
                  style={{ fontSize: "0.76rem", padding: "0.38rem 0.7rem", flexShrink: 0 }}
                  onClick={() => onSelfAssign(c.id)}
                >
                  <Plus size={13} /> Assign to me
                </button>
              )}
            </div>
          );
        })}
        {shown.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "0.82rem", padding: "0.5rem 0" }}>
            No drawings match.
          </p>
        )}
      </div>
    </div>
  );
}

/* ----- designer / on-site task row ----- */
function TaskActionRow({
  task,
  role,
  meId,
  onChanged,
}: {
  task: Task;
  role: string;
  meId: string;
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

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

  return (
    <div style={{ border: "1px solid #e6ebf2", borderRadius: 10, padding: "0.8rem 0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: "0.9rem" }}>{task.category.name}</div>
          <TaskPeople
            assignees={
              task.assignees?.length
                ? task.assignees.map((a) => a.user.name)
                : task.designer
                ? [task.designer.name]
                : []
            }
            reviewer={task.reviewer?.name ?? null}
            deadline={task.deadline}
          />
        </div>
        <StatusBadge status={task.status} />
      </div>

      <ErrorText>{error}</ErrorText>

      {role === "DESIGNER" && task.status === "REJECTED" && (
        <div
          data-testid="rejected-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            padding: "0.55rem 0.7rem",
            borderRadius: 9,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          <RotateCcw size={15} /> Changes requested — upload a revised drawing.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {role === "ONSITE" ? (
          /* on-site: open the drawing first; approve / reject live inside it */
          <button
            className="btn btn-primary"
            data-testid="open-drawing-btn"
            style={{ fontSize: "0.8rem" }}
            onClick={() => setReviewOpen(true)}
          >
            <ArrowUpRight size={14} /> Open Drawing
          </button>
        ) : role === "DESIGNER" ? (
          <>
            {(
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
                  data-testid="designer-upload-btn"
                  style={
                    task.status === "REJECTED"
                      ? {
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          background: "linear-gradient(180deg,#ef4444,#dc2626)",
                          border: "none",
                          padding: "0.6rem 1rem",
                          boxShadow: "0 6px 16px -6px rgba(220,38,38,0.6)",
                          animation: "pulseUpload 1.8s ease-in-out infinite",
                        }
                      : { fontSize: "0.8rem" }
                  }
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {busy ? <span className="spinner" /> : <Upload size={task.status === "REJECTED" ? 16 : 14} />}
                  {task.status === "REJECTED"
                    ? "Upload Revision Now"
                    : task.status === "APPROVED"
                    ? "Replace Drawing"
                    : "Add Design"}
                </button>
              </>
            )}
            <Link href={`/tasks/${task.id}`} className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
              View <ArrowUpRight size={14} />
            </Link>
          </>
        ) : (
          <Link href={`/tasks/${task.id}`} className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
            Manage <ArrowUpRight size={14} />
          </Link>
        )}
      </div>

      {reviewOpen && (
        <DrawingReviewModal
          taskId={task.id}
          meId={meId}
          onClose={() => setReviewOpen(false)}
          onDone={onChanged}
        />
      )}
    </div>
  );
}
