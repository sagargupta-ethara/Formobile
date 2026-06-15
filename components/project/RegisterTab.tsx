"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { api, Badge, Skeleton, Modal, ErrorText } from "@/components/ui";
import Select from "@/components/Select";

interface Spec {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  appliesTo: string[];
  discipline: string;
  specialization: { id: string; name: string } | null;
}

const DISCIPLINES = [
  { key: "INTERIOR", label: "Interior Design" },
  { key: "STRUCTURE", label: "Structure" },
  { key: "MEP", label: "MEP" },
  { key: "WOODWORK", label: "Woodwork" },
] as const;

const ZONES = [
  { key: "BASEMENT", label: "Basement", bg: "#e2e8f0", fg: "#475569" },
  { key: "STILT", label: "Stilt", bg: "#fef3c7", fg: "#b45309" },
  { key: "FLOOR", label: "Floor", bg: "#dbeafe", fg: "#1d4ed8" },
  { key: "TERRACE", label: "Terrace", bg: "#dcfce7", fg: "#15803d" },
] as const;

/** Project Settings: this project's own drawing register — add, edit,
 *  delete drawing types and their review routing, without affecting other
 *  projects. */
export default function RegisterTab({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      api<{ categories: Category[] }>(`/api/categories?projectId=${projectId}`),
      api<{ specializations: Spec[] }>("/api/specializations"),
    ]);
    setCats(c.categories);
    setSpecs(s.specializations);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(c: Category) {
    if (!confirm(`Remove "${c.name}" from this project's register?`)) return;
    try {
      await api(`/api/categories/${c.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  if (!cats) return <Skeleton rows={4} />;

  const visible = cats.filter(
    (c) =>
      zoneFilter === "ALL" || c.appliesTo.length === 0 || c.appliesTo.includes(zoneFilter)
  );

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
            This project's own register — changes here don't affect other projects.
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> Add Drawing
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "10px 0" }}>
        {[{ key: "ALL", label: "All" }, ...ZONES].map((z) => (
          <button
            key={z.key}
            onClick={() => setZoneFilter(z.key)}
            style={{
              border: "1px solid",
              borderColor: zoneFilter === z.key ? "#1e293b" : "var(--color-line)",
              background: zoneFilter === z.key ? "#1e293b" : "#fff",
              color: zoneFilter === z.key ? "#fff" : "#64748b",
              borderRadius: 999,
              padding: "0.28rem 0.7rem",
              fontSize: "0.74rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {z.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
        {visible.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "0.45rem 0.6rem",
              background: "#f8fafc",
              borderRadius: 7,
              fontSize: "0.82rem",
            }}
          >
            <span style={{ minWidth: 0 }}>{c.name}</span>
            <span style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
              <Badge bg="#f8fafc" fg="#64748b">
                {DISCIPLINES.find((d) => d.key === c.discipline)?.label ?? c.discipline}
              </Badge>
              {c.appliesTo.map((z) => {
                const zone = ZONES.find((x) => x.key === z);
                return zone ? (
                  <span
                    key={z}
                    title={zone.label}
                    style={{
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      padding: "0.12rem 0.4rem",
                      borderRadius: 999,
                      background: zone.bg,
                      color: zone.fg,
                    }}
                  >
                    {zone.label[0]}
                  </span>
                ) : null;
              })}
              {c.specialization && (
                <Badge bg="#eef2ff" fg="#4338ca">{c.specialization.name}</Badge>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => setEditing(c)}
                    title="Edit"
                    style={iconBtn}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    title="Delete"
                    style={{ ...iconBtn, color: "#dc2626" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
        {visible.length === 0 && (
          <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>No drawings in this zone.</p>
        )}
      </div>

      {(creating || editing) && (
        <DrawingModal
          projectId={projectId}
          category={editing}
          specs={specs}
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

function DrawingModal({
  projectId,
  category,
  specs,
  onClose,
  onSaved,
}: {
  projectId: string;
  category: Category | null;
  specs: Spec[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [specId, setSpecId] = useState(category?.specialization?.id ?? "");
  const [zones, setZones] = useState<string[]>(category?.appliesTo ?? []);
  const [discipline, setDiscipline] = useState(category?.discipline ?? "INTERIOR");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
          specializationId: specId || null,
          appliesTo: zones,
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
    <Modal open onClose={onClose} title={editing ? "Edit Drawing Type" : "Add Drawing Type"}>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label className="label">Drawing Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
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
            <label className="label">Routes to Team</label>
            <Select
              value={specId}
              onChange={setSpecId}
              placeholder="No team (everyone reviews)"
              options={[
                { value: "", label: "No team (everyone reviews)" },
                ...specs.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div>
            <label className="label">Applies To</label>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {ZONES.map((z) => {
                const on = zones.includes(z.key);
                return (
                  <button
                    key={z.key}
                    type="button"
                    onClick={() =>
                      setZones((zs) => (on ? zs.filter((x) => x !== z.key) : [...zs, z.key]))
                    }
                    style={{
                      border: "1px solid",
                      borderColor: on ? z.fg : "var(--color-line)",
                      background: on ? z.bg : "#fff",
                      color: on ? z.fg : "#94a3b8",
                      borderRadius: 999,
                      padding: "0.3rem 0.7rem",
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {z.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: "0.7rem", color: "#b3bfd0", margin: "5px 0 0" }}>
              None selected = available on every level.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save Changes" : "Add Drawing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
