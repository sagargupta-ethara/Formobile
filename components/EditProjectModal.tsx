"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, Modal, ErrorText } from "@/components/ui";
import Select from "@/components/Select";
import { PROJECT_STATUS_LABEL } from "@/lib/format";

/** Admin: edit the details captured at project creation, or delete it. */
export default function EditProjectModal({
  project,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: { id: string; name: string; code: string; location: string | null; status: string };
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [form, setForm] = useState({
    name: project.name,
    code: project.code,
    location: project.location ?? "",
    status: project.status,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          location: form.location || null,
          status: form.status,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete "${project.name}" with all its floors, drawings, tasks and files? This cannot be undone.`
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit Project" wide>
      <form onSubmit={save}>
        <ErrorText>{error}</ErrorText>
        <div className="form-grid">
          <div>
            <label className="label">Project Name *</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Project Code *</label>
            <input
              className="input mono"
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Status</label>
            <Select
              value={form.status}
              onChange={(v) => set("status", v)}
              options={Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>
            <Trash2 size={14} /> Delete Project
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
