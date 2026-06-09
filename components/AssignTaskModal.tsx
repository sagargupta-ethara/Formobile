"use client";

import { useEffect, useState } from "react";
import { api, Modal, ErrorText } from "@/components/ui";
import DateTimePicker from "@/components/DateTimePicker";

interface Opt {
  id: string;
  name: string;
}
interface Floor {
  id: string;
  floorName: string;
}

export default function AssignTaskModal({
  fixedProjectId,
  fixedFloorId,
  onClose,
  onCreated,
}: {
  fixedProjectId?: string;
  fixedFloorId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<Opt[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [designers, setDesigners] = useState<Opt[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    projectId: fixedProjectId ?? "",
    floorId: fixedFloorId ?? "",
    categoryId: "",
    designerId: "",
    deadline: "",
    priority: "MEDIUM",
  });
  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    Promise.all([
      fixedProjectId
        ? Promise.resolve({ projects: [] })
        : api<{ projects: Opt[] }>("/api/projects"),
      api<{ categories: Opt[] }>("/api/categories"),
      api<{ users: Opt[] }>("/api/users?role=DESIGNER"),
    ]).then(([p, c, d]) => {
      setProjects(p.projects);
      setCategories(c.categories);
      setDesigners(d.users);
    });
  }, [fixedProjectId]);

  // load floors when project changes
  useEffect(() => {
    if (!form.projectId) {
      setFloors([]);
      return;
    }
    api<{ floors: Floor[] }>(`/api/projects/${form.projectId}/floors`).then((r) =>
      setFloors(r.floors)
    );
  }, [form.projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
              <select
                className="select"
                value={form.projectId}
                onChange={(e) => set("projectId", e.target.value)}
                required
              >
                <option value="">Select project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Floor *</label>
            <select
              className="select"
              value={form.floorId}
              onChange={(e) => set("floorId", e.target.value)}
              required
              disabled={!!fixedFloorId}
            >
              <option value="">Select floor…</option>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.floorName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Design Category *</label>
            <select
              className="select"
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              required
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Assign To (Designer) *</label>
            <select
              className="select"
              value={form.designerId}
              onChange={(e) => set("designerId", e.target.value)}
              required
            >
              <option value="">Select designer…</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
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
          <div>
            <label className="label">Priority</label>
            <select
              className="select"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
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
