"use client";

import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { api, Modal, ErrorText } from "@/components/ui";
import DateTimePicker from "@/components/DateTimePicker";
import Select from "@/components/Select";

interface Assignable {
  id: string;
  name: string;
  role: string;
  department: string | null;
}

/** Admin: modify an assigned task — reassign, change deadline, or delete. */
export default function TaskEditModal({
  taskId,
  current,
  onClose,
  onSaved,
}: {
  taskId: string;
  current: {
    designerId?: string | null;
    designerIds?: string[];
    reviewerId?: string | null;
    deadline?: string | null;
    title?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [people, setPeople] = useState<Assignable[]>([]);
  const [assignees, setAssignees] = useState<string[]>(
    current.designerIds?.length
      ? current.designerIds
      : current.designerId
      ? [current.designerId]
      : []
  );
  const [reviewerId, setReviewerId] = useState(current.reviewerId ?? "");
  const [deadline, setDeadline] = useState(current.deadline ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ users: Assignable[] }>("/api/users?assignable=1").then((d) =>
      setPeople(d.users)
    );
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          designerIds: assignees.length ? assignees : undefined,
          reviewerId: reviewerId || undefined,
          deadline: deadline || null,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this task, its files and reviews?")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/tasks/${taskId}`, { method: "DELETE" });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={current.title ?? "Edit Task"}>
      <form onSubmit={save}>
        <ErrorText>{error}</ErrorText>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Assigned To (one or more)</label>
            <Select
              value=""
              onChange={(v) => setAssignees((a) => (a.includes(v) ? a : [...a, v]))}
              placeholder={assignees.length ? "Add another member…" : "Select team member…"}
              searchable
              options={people
                .filter((p) => !assignees.includes(p.id))
                .map((p) => ({
                  value: p.id,
                  label: p.name,
                  group: p.department ?? "Other",
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
                      {p?.name ?? "…"}
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
            <label className="label">Reviewer (off-site)</label>
            <Select
              value={reviewerId}
              onChange={setReviewerId}
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
          </div>
          <div>
            <label className="label">Deadline</label>
            <DateTimePicker
              mode="datetime"
              value={deadline}
              onChange={setDeadline}
              placeholder="Pick deadline"
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={remove}
          >
            <Trash2 size={14} /> Delete Task
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
