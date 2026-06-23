"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, Modal, ErrorText } from "@/components/ui";
import DateTimePicker from "@/components/DateTimePicker";
import Select from "@/components/Select";

interface Opt {
  id: string;
  name: string;
}
interface Person extends Opt {
  department: string | null;
  role: string;
}
interface Category extends Opt {
  appliesTo: string[];
  floorIds: string[];
}
interface Floor {
  id: string;
  floorName: string;
  floorType: string;
}

export default function AssignTaskModal({
  fixedProjectId,
  fixedFloorId,
  fixedCategoryId,
  onClose,
  onCreated,
}: {
  fixedProjectId?: string;
  fixedFloorId?: string;
  fixedCategoryId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<Opt[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    projectId: fixedProjectId ?? "",
    floorId: fixedFloorId ?? "",
    categoryId: fixedCategoryId ?? "",
    reviewerId: "",
    deadline: "",
  });
  // one or more team members, possibly from different departments
  const [assignees, setAssignees] = useState<string[]>([]);
  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    Promise.all([
      fixedProjectId
        ? Promise.resolve({ projects: [] })
        : api<{ projects: Opt[] }>("/api/projects"),
      api<{ users: Person[] }>("/api/users?assignable=1"),
    ]).then(([p, u]) => {
      setProjects(p.projects);
      setPeople(u.users);
    });
  }, [fixedProjectId]);

  // floors + this project's drawing register load when the project changes
  useEffect(() => {
    if (!form.projectId) {
      setFloors([]);
      setCategories([]);
      return;
    }
    api<{ floors: Floor[] }>(`/api/projects/${form.projectId}/floors`).then((r) =>
      setFloors(r.floors)
    );
    api<{ categories: Category[] }>(
      `/api/categories?projectId=${form.projectId}`
    ).then((r) => setCategories(r.categories));
  }, [form.projectId]);

  // Per-floor register: only drawings enabled on the selected floor.
  const floorType = floors.find((f) => f.id === form.floorId)?.floorType;
  const visibleCategories = form.floorId
    ? categories.filter((c) => c.floorIds?.includes(form.floorId))
    : categories;

  useEffect(() => {
    if (
      form.categoryId &&
      floorType &&
      !visibleCategories.some((c) => c.id === form.categoryId)
    ) {
      setForm((f) => ({ ...f, categoryId: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.floorId, categories.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (
      !form.projectId ||
      !form.floorId ||
      !form.categoryId ||
      assignees.length === 0 ||
      !form.reviewerId
    ) {
      setError(
        "Please pick a project, floor, drawing type, at least one team member, and the off-site reviewer."
      );
      return;
    }
    setSaving(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, designerIds: assignees }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Assign Design Task" wide>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>
        <div className="form-grid">
          {!fixedProjectId && (
            <div>
              <label className="label">Project *</label>
              <Select
                value={form.projectId}
                onChange={(v) => set("projectId", v)}
                placeholder="Select project…"
                options={projects.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          )}
          <div>
            <label className="label">Floor *</label>
            <Select
              value={form.floorId}
              onChange={(v) => set("floorId", v)}
              placeholder="Select floor…"
              disabled={!!fixedFloorId}
              options={floors.map((f) => ({
                value: f.id,
                label: f.floorName,
                hint:
                  f.floorType !== "FLOOR"
                    ? f.floorType.charAt(0) + f.floorType.slice(1).toLowerCase()
                    : undefined,
              }))}
            />
          </div>
          <div>
            <label className="label">Drawing Type *</label>
            <Select
              value={form.categoryId}
              onChange={(v) => set("categoryId", v)}
              placeholder={form.floorId ? "Select drawing…" : "Pick a floor first…"}
              disabled={!form.floorId || !!fixedCategoryId}
              searchable
              options={visibleCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
            {floorType && !fixedCategoryId && (
              <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "5px 0 0" }}>
                {visibleCategories.length} drawing types for this{" "}
                {floorType.toLowerCase()} level
              </p>
            )}
          </div>
          <div>
            <label className="label">Assign To (one or more) *</label>
            <Select
              value=""
              onChange={(v) => setAssignees((a) => (a.includes(v) ? a : [...a, v]))}
              placeholder={
                assignees.length ? "Add another member…" : "Select team member…"
              }
              searchable
              options={people
                .filter((p) => !assignees.includes(p.id))
                .map((p) => ({
                  value: p.id,
                  label: p.name,
                  group: p.department ?? (p.role === "ONSITE" ? "On-Site" : "Designers"),
                }))}
            />
            {assignees.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                {assignees.map((id) => {
                  const p = people.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: "0.76rem",
                        fontWeight: 600,
                        background: "#eef2ff",
                        color: "#4338ca",
                        borderRadius: 999,
                        padding: "0.22rem 0.4rem 0.22rem 0.65rem",
                      }}
                    >
                      {p?.name ?? id}
                      <button
                        type="button"
                        onClick={() => setAssignees((a) => a.filter((x) => x !== id))}
                        style={{
                          border: "none",
                          background: "rgba(67,56,202,0.12)",
                          borderRadius: 999,
                          width: 16,
                          height: 16,
                          display: "grid",
                          placeItems: "center",
                          cursor: "pointer",
                          color: "#4338ca",
                          padding: 0,
                        }}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="label">Off-Site Reviewer *</label>
            <Select
              value={form.reviewerId}
              onChange={(v) => set("reviewerId", v)}
              placeholder="Select off-site reviewer…"
              searchable
              options={people
                .filter((p) => p.role === "ONSITE")
                .map((p) => ({
                  value: p.id,
                  label: p.name,
                  group: p.department ?? "On-Site",
                }))}
            />
            <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: "5px 0 0" }}>
              Has 24h to approve or reject after each upload.
            </p>
          </div>
          <div>
            <label className="label">Deadline</label>
            <DateTimePicker
              mode="datetime"
              value={form.deadline}
              onChange={(v) => set("deadline", v)}
              placeholder="Pick deadline"
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Assigning…" : "Assign Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
