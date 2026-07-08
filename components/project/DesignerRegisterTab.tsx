"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { api, Badge, Modal, ErrorText, StatusBadge } from "@/components/ui";
import Select from "@/components/Select";
import DateTimePicker from "@/components/DateTimePicker";

interface Floor {
  id: string;
  floorName: string;
  floorType: string;
  order: number;
}
interface Category {
  id: string;
  name: string;
  floorIds: string[];
  discipline: string;
}
interface Task {
  id: string;
  status: string;
  floorId: string;
  designerId?: string | null;
  category: { id: string; name: string; discipline?: string };
  designer: { id?: string; name: string } | null;
  assignees?: { user: { id: string; name: string } }[];
}
interface Person {
  id: string;
  name: string;
  role: string;
  department: string | null;
}

const DISCIPLINES = [
  { key: "INTERIOR", label: "Interior Design" },
  { key: "STRUCTURE", label: "Architecture" },
  { key: "MEP", label: "MEP" },
  { key: "WOODWORK", label: "Woodwork" },
] as const;

const discLabel = (d: string) => DISCIPLINES.find((x) => x.key === d)?.label ?? d;

/** Designer-facing register: browse every drawing floor-by-floor OR across all
 *  floors, see who already has each one, and self-assign (choosing a floor when
 *  browsing "All"). */
export default function DesignerRegisterTab({
  projectId,
  floors,
  cats,
  tasks,
  meId,
  onReload,
}: {
  projectId: string;
  floors: Floor[];
  cats: Category[];
  tasks: Task[];
  meId: string;
  onReload: () => void;
}) {
  const sortedFloors = useMemo(
    () => [...floors].sort((a, b) => a.order - b.order),
    [floors]
  );
  const [floorId, setFloorId] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [assignCat, setAssignCat] = useState<{ cat: Category; floors: Floor[] } | null>(null);

  const floorName = (id: string) => sortedFloors.find((f) => f.id === id)?.floorName ?? "";

  const tasksByCat = new Map<string, Task[]>();
  for (const t of tasks) {
    const arr = tasksByCat.get(t.category.id) ?? [];
    arr.push(t);
    tasksByCat.set(t.category.id, arr);
  }

  function assigneesOf(t: Task): string[] {
    return t.assignees?.length
      ? t.assignees.map((a) => a.user.name)
      : t.designer
      ? [t.designer.name]
      : [];
  }
  const isMine = (t: Task) =>
    t.designerId === meId || (t.assignees?.some((a) => a.user.id === meId) ?? false);

  const isAll = floorId === "ALL";
  const matchesQ = (c: Category) => c.name.toLowerCase().includes(q.toLowerCase());

  const rows: Category[] = isAll
    ? cats.filter(matchesQ).sort((a, b) => a.name.localeCompare(b.name))
    : cats
        .filter((c) => c.floorIds?.includes(floorId))
        .filter(matchesQ)
        .sort((a, b) => a.name.localeCompare(b.name));

  function openAssign(c: Category) {
    const taken = new Set((tasksByCat.get(c.id) ?? []).map((t) => t.floorId));
    const candidates = isAll
      ? sortedFloors.filter((f) => c.floorIds?.includes(f.id) && !taken.has(f.id))
      : sortedFloors.filter((f) => f.id === floorId);
    setAssignCat({ cat: c, floors: candidates });
  }

  return (
    <div className="card" style={{ padding: "1.2rem" }} data-testid="designer-register">
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 700 }}>Drawing Register</div>
        <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "2px 0 0" }}>
          Pick up drawings to work on. Browse a single floor or "All" — anything already taken shows who has it.
        </p>
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
        {[{ id: "ALL", floorName: "All" } as { id: string; floorName: string }, ...sortedFloors].map(
          (f) => {
            const active = f.id === floorId;
            return (
              <button
                key={f.id}
                data-testid={`designer-floor-chip-${f.id}`}
                onClick={() => setFloorId(f.id)}
                style={{
                  border: "1px solid",
                  borderColor: active ? "#1e293b" : "var(--color-line)",
                  background: active ? "#1e293b" : "#fff",
                  color: active ? "#fff" : "#64748b",
                  borderRadius: 999,
                  padding: "0.28rem 0.7rem",
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.floorName}
              </button>
            );
          }
        )}
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#fff",
          border: "1px solid var(--color-line)",
          borderRadius: 9,
          padding: "0.4rem 0.7rem",
          marginBottom: 12,
          width: "100%",
          maxWidth: 340,
        }}
      >
        <Search size={15} color="#94a3b8" />
        <input
          data-testid="designer-register-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search drawings…"
          style={{ border: "none", outline: "none", fontSize: "0.86rem", background: "transparent", width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
        {rows.map((c) => {
          const catTasks = tasksByCat.get(c.id) ?? [];
          if (isAll) {
            const taken = new Set(catTasks.map((t) => t.floorId));
            const available = (c.floorIds ?? []).filter((fid) => !taken.has(fid));
            const mineHere = catTasks.some(isMine);
            return (
              <div
                key={c.id}
                data-testid={`designer-register-row-${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0.6rem 0.7rem",
                  border: "1px solid",
                  borderColor: mineHere ? "#1d4ed8" : "#eef2f7",
                  borderRadius: 9,
                  background: mineHere ? "#eff6ff" : "#fafcfe",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>{c.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                    <Badge bg="#f8fafc" fg="#64748b">{discLabel(c.discipline)}</Badge>
                    <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      on {c.floorIds?.length ?? 0} floor{(c.floorIds?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                    {catTasks.map((t) => (
                      <span
                        key={t.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: "0.68rem",
                          fontWeight: 600,
                          padding: "0.1rem 0.4rem",
                          borderRadius: 999,
                          background: isMine(t) ? "#dbeafe" : "#f1f5f9",
                          color: isMine(t) ? "#1d4ed8" : "#64748b",
                        }}
                      >
                        {floorName(t.floorId).replace(/\s*Floor$/i, "")} · {assigneesOf(t)[0] ?? "?"}
                        {isMine(t) ? " (you)" : ""}
                      </span>
                    ))}
                  </div>
                </div>
                {available.length > 0 ? (
                  <button
                    className="btn btn-primary"
                    data-testid={`designer-self-assign-${c.id}`}
                    style={{ fontSize: "0.76rem", padding: "0.38rem 0.7rem", flexShrink: 0 }}
                    onClick={() => openAssign(c)}
                  >
                    <Plus size={13} /> Assign to me
                  </button>
                ) : (
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", flexShrink: 0 }}>Fully assigned</span>
                )}
              </div>
            );
          }
          const t = catTasks.find((x) => x.floorId === floorId);
          const mine = t ? isMine(t) : false;
          return (
            <div
              key={c.id}
              data-testid={`designer-register-row-${c.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.55rem 0.7rem",
                border: "1px solid",
                borderColor: mine ? "#1d4ed8" : "#eef2f7",
                borderRadius: 9,
                background: mine ? "#eff6ff" : t ? "#fff" : "#fafcfe",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "#1e293b" }}>{c.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  <Badge bg="#f8fafc" fg="#64748b">{discLabel(c.discipline)}</Badge>
                  {t && (
                    <span
                      data-testid={`designer-assignee-${c.id}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.72rem", color: mine ? "#1d4ed8" : "#64748b", fontWeight: 600 }}
                    >
                      <UserIcon size={12} /> {assigneesOf(t).join(", ") || "Assigned"}
                      {mine ? " (you)" : ""}
                    </span>
                  )}
                </div>
              </div>
              {t ? (
                <span style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <StatusBadge status={t.status} />
                  {mine && (
                    <Link href={`/tasks/${t.id}`} className="btn btn-ghost" style={{ fontSize: "0.74rem", padding: "0.35rem 0.6rem" }}>
                      Open
                    </Link>
                  )}
                </span>
              ) : (
                <button
                  className="btn btn-primary"
                  data-testid={`designer-self-assign-${c.id}`}
                  style={{ fontSize: "0.76rem", padding: "0.38rem 0.7rem", flexShrink: 0 }}
                  onClick={() => openAssign(c)}
                >
                  <Plus size={13} /> Assign to me
                </button>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>No drawings match.</p>
        )}
      </div>

      {assignCat && (
        <SelfAssignModal
          projectId={projectId}
          category={assignCat.cat}
          floors={assignCat.floors}
          onClose={() => setAssignCat(null)}
          onDone={() => {
            setAssignCat(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function SelfAssignModal({
  projectId,
  category,
  floors,
  onClose,
  onDone,
}: {
  projectId: string;
  category: Category;
  floors: Floor[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [reviewers, setReviewers] = useState<Person[]>([]);
  const [reviewerId, setReviewerId] = useState("");
  const [floorId, setFloorId] = useState(floors.length === 1 ? floors[0].id : "");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ users: Person[] }>("/api/users?assignable=1")
      .then((d) =>
        setReviewers(
          d.users
            .filter((u) => u.role === "ONSITE")
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!floorId) {
      setError("Please choose which floor to assign this drawing on.");
      return;
    }
    if (!reviewerId) {
      setError("Please choose an off-site reviewer.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          floorId,
          categoryIds: [category.id],
          reviewerId,
          deadline: deadline || null,
        }),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to assign");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Assign to me — ${category.name}`}>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Floor *</label>
            {floors.length === 1 ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid var(--color-line)",
                  borderRadius: 9,
                  padding: "0.55rem 0.75rem",
                  background: "#f8fafc",
                  fontWeight: 600,
                  fontSize: "0.86rem",
                  color: "#1e293b",
                }}
              >
                {floors[0].floorName}
              </div>
            ) : (
              <Select
                value={floorId}
                onChange={setFloorId}
                placeholder="Select a floor…"
                options={floors.map((f) => ({ value: f.id, label: f.floorName }))}
              />
            )}
          </div>
          <div>
            <label className="label">Off-Site Reviewer *</label>
            <Select
              value={reviewerId}
              onChange={setReviewerId}
              placeholder="Select off-site reviewer…"
              searchable
              options={reviewers.map((p) => ({
                value: p.id,
                label: p.name,
                group: p.department ?? "On-Site",
              }))}
            />
            <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: "5px 0 0" }}>
              They have 24h to approve or reject after each upload.
            </p>
          </div>
          <div>
            <label className="label">Deadline</label>
            <DateTimePicker
              mode="datetime"
              value={deadline}
              onChange={setDeadline}
              placeholder="Pick a deadline (optional)"
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" data-testid="designer-self-assign-submit" disabled={busy}>
            {busy ? "Assigning…" : "Assign to me"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
