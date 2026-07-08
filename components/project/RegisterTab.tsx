"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Layers } from "lucide-react";
import { api, Badge, Skeleton, Modal, ErrorText } from "@/components/ui";
import Select from "@/components/Select";

interface Category {
  id: string;
  name: string;
  appliesTo: string[];
  floorIds: string[];
  discipline: string;
}
interface Floor {
  id: string;
  floorName: string;
  floorType: string;
  order: number;
}

const DISCIPLINES = [
  { key: "INTERIOR", label: "Interior Design" },
  { key: "STRUCTURE", label: "Architecture" },
  { key: "MEP", label: "MEP" },
  { key: "WOODWORK", label: "Woodwork" },
] as const;

/** Project Settings: this project's own drawing register. Each specific floor
 *  has its own editable list of drawings — adding/removing a drawing only
 *  affects the selected floor. */
export default function RegisterTab({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [floorFilter, setFloorFilter] = useState("ALL"); // "ALL" or a floor id
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);

  const load = useCallback(async () => {
    const [c, f] = await Promise.all([
      api<{ categories: Category[] }>(`/api/categories?projectId=${projectId}`),
      api<{ floors: Floor[] }>(`/api/projects/${projectId}/floors`),
    ]);
    setCats(c.categories);
    setFloors([...f.floors].sort((a, b) => a.order - b.order));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedFloor = floors.find((f) => f.id === floorFilter) ?? null;

  async function removeFromFloor(c: Category) {
    if (!selectedFloor) return;
    if (!confirm(`Remove "${c.name}" from ${selectedFloor.floorName}?`)) return;
    try {
      await api(`/api/categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          floorIds: c.floorIds.filter((id) => id !== selectedFloor.id),
        }),
      });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  async function deleteType(c: Category) {
    if (!confirm(`Delete "${c.name}" from this project entirely (all floors)?`))
      return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!cats) return <Skeleton rows={4} />;

  const visible =
    floorFilter === "ALL"
      ? cats
      : cats.filter((c) => c.floorIds?.includes(floorFilter));

  function floorLabel(f: Floor) {
    return f.floorName.replace(/\s*Floor$/i, "").trim() || f.floorName;
  }

  return (
    <div className="card" style={{ padding: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700 }}>
            Drawing Register
            <span className="mono" style={{ fontWeight: 500, color: "#94a3b8", fontSize: "0.78rem", marginLeft: 8 }}>
              {visible.length}
            </span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: "2px 0 0" }}>
            {selectedFloor
              ? `Drawings on ${selectedFloor.floorName} — changes here affect this floor only.`
              : "This project's full register across all floors."}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {selectedFloor && (
              <button
                className="btn btn-ghost"
                data-testid="register-manage-floor-btn"
                onClick={() => setManaging(true)}
              >
                <Layers size={15} /> Manage {floorLabel(selectedFloor)}
              </button>
            )}
            <button
              className="btn btn-primary"
              data-testid="register-add-drawing-btn"
              onClick={() => setCreating(true)}
            >
              <Plus size={15} /> Add Drawing
            </button>
          </div>
        )}
      </div>

      {/* floor filter chips */}
      <div data-testid="register-floor-chips" style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
        {[{ id: "ALL", label: "All" }, ...floors.map((f) => ({ id: f.id, label: f.floorName }))].map((chip) => {
          const active = floorFilter === chip.id;
          return (
            <button
              key={chip.id}
              data-testid={`register-chip-${chip.id}`}
              onClick={() => setFloorFilter(chip.id)}
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
              {chip.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
        {visible.map((c) => (
          <div key={c.id} className="register-row" data-testid={`register-row-${c.id}`}>
            <span className="reg-name">{c.name}</span>
            <span className="reg-meta">
              <Badge bg="#f8fafc" fg="#64748b">
                {DISCIPLINES.find((d) => d.key === c.discipline)?.label ?? c.discipline}
              </Badge>
              {floorFilter === "ALL" && (
                <span
                  title={`On ${c.floorIds?.length ?? 0} floor(s)`}
                  style={{
                    fontSize: "0.66rem",
                    fontWeight: 700,
                    padding: "0.12rem 0.45rem",
                    borderRadius: 999,
                    background: "#eef2ff",
                    color: "#4338ca",
                  }}
                >
                  {c.floorIds?.length ?? 0} {(c.floorIds?.length ?? 0) === 1 ? "floor" : "floors"}
                </span>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setEditing(c)}
                    title="Edit drawing"
                    data-testid={`register-edit-${c.id}`}
                    style={iconBtn}
                  >
                    <Pencil size={13} />
                  </button>
                  {selectedFloor ? (
                    <button
                      onClick={() => removeFromFloor(c)}
                      title={`Remove from ${selectedFloor.floorName}`}
                      data-testid={`register-remove-floor-${c.id}`}
                      style={{ ...iconBtn, color: "#dc2626" }}
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => deleteType(c)}
                      title="Delete drawing (all floors)"
                      data-testid={`register-delete-${c.id}`}
                      style={{ ...iconBtn, color: "#dc2626" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </>
              )}
            </span>
          </div>
        ))}
        {visible.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>
            {selectedFloor
              ? `No drawings on ${selectedFloor.floorName} yet.`
              : "No drawings in this project's register."}
          </p>
        )}
      </div>

      {(creating || editing) && (
        <DrawingModal
          projectId={projectId}
          category={editing}
          floors={floors}
          defaultFloorId={creating && selectedFloor ? selectedFloor.id : undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {managing && selectedFloor && (
        <FloorDrawingsModal
          floor={selectedFloor}
          cats={cats}
          onClose={() => setManaging(false)}
          onSaved={() => {
            setManaging(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  border: "1px solid var(--color-line)",
  background: "#fff",
  borderRadius: 7,
  width: 26,
  height: 26,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  color: "#64748b",
};

/* ---- create / edit a single drawing type (name, dept, routing, floors) ---- */
function DrawingModal({
  projectId,
  category,
  floors,
  defaultFloorId,
  onClose,
  onSaved,
}: {
  projectId: string;
  category: Category | null;
  floors: Floor[];
  defaultFloorId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [floorIds, setFloorIds] = useState<string[]>(
    category?.floorIds ?? (defaultFloorId ? [defaultFloorId] : [])
  );
  const [discipline, setDiscipline] = useState(category?.discipline ?? "INTERIOR");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setFloorIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(editing ? `/api/categories/${category!.id}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          projectId,
          floorIds,
          discipline,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? "Edit Drawing" : "Add Drawing"}>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Drawing Name *</label>
            <input
              className="input"
              data-testid="drawing-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label">Department (floor head-tab)</label>
            <Select
              value={discipline}
              onChange={setDiscipline}
              options={DISCIPLINES.map((d) => ({ value: d.key, label: d.label }))}
            />
          </div>
          <div>
            <label className="label">On Floors</label>
            <div data-testid="drawing-floors-picker" style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {floors.length > 0 && (
                <button
                  type="button"
                  data-testid="drawing-floor-all"
                  onClick={() =>
                    setFloorIds(floorIds.length === floors.length ? [] : floors.map((f) => f.id))
                  }
                  style={{
                    border: "1px solid",
                    borderColor: floorIds.length === floors.length ? "#1d4ed8" : "#94a3b8",
                    background: floorIds.length === floors.length ? "#1d4ed8" : "#fff",
                    color: floorIds.length === floors.length ? "#fff" : "#475569",
                    borderRadius: 999,
                    padding: "0.3rem 0.7rem",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  All floors
                </button>
              )}
              {floors.map((f) => {
                const on = floorIds.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    data-testid={`drawing-floor-${f.id}`}
                    onClick={() => toggle(f.id)}
                    style={{
                      border: "1px solid",
                      borderColor: on ? "#1d4ed8" : "var(--color-line)",
                      background: on ? "#dbeafe" : "#fff",
                      color: on ? "#1d4ed8" : "#94a3b8",
                      borderRadius: 999,
                      padding: "0.3rem 0.7rem",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {f.floorName}
                  </button>
                );
              })}
              {floors.length === 0 && (
                <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  Add floors to the Building tab first.
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.7rem", color: "#b3bfd0", margin: "5px 0 0" }}>
              Pick the floors this drawing is required on.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" data-testid="drawing-save-btn" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save Changes" : "Add Drawing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---- bulk manage which drawings are on a single floor ---- */
function FloorDrawingsModal({
  floor,
  cats,
  onClose,
  onSaved,
}: {
  floor: Floor;
  cats: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const original = useMemo(
    () => new Set(cats.filter((c) => c.floorIds?.includes(floor.id)).map((c) => c.id)),
    [cats, floor.id]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(original));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  const byDiscipline = DISCIPLINES.map((d) => ({
    ...d,
    items: shown.filter((c) => c.discipline === d.key),
  })).filter((g) => g.items.length > 0);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const changed = cats.filter(
        (c) => original.has(c.id) !== selected.has(c.id)
      );
      for (const c of changed) {
        const next = selected.has(c.id)
          ? [...new Set([...(c.floorIds ?? []), floor.id])]
          : (c.floorIds ?? []).filter((id) => id !== floor.id);
        await api(`/api/categories/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ floorIds: next }),
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Drawings on ${floor.floorName}`} wide>
      <ErrorText>{error}</ErrorText>
      <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: "0 0 10px" }}>
        Tick the drawings required on this floor. Other floors are unaffected.
      </p>
      <input
        className="input"
        data-testid="floor-drawings-search"
        placeholder="Search drawings…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 14 }}>
        {byDiscipline.map((g) => (
          <div key={g.key}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 6 }}>
              {g.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {g.items.map((c) => {
                const on = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`floor-drawing-toggle-${c.id}`}
                    onClick={() => toggle(c.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      textAlign: "left",
                      border: "1px solid",
                      borderColor: on ? "#1d4ed8" : "#eef2f7",
                      background: on ? "#eff6ff" : "#fff",
                      borderRadius: 9,
                      padding: "0.5rem 0.7rem",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 5,
                        border: "1px solid",
                        borderColor: on ? "#1d4ed8" : "#cbd5e1",
                        background: on ? "#1d4ed8" : "#fff",
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.7rem",
                        flexShrink: 0,
                      }}
                    >
                      {on ? "✓" : ""}
                    </span>
                    <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "#1e293b" }}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>No drawings match.</p>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 16 }}>
        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>
          {selected.size} selected
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            data-testid="floor-drawings-save-btn"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
