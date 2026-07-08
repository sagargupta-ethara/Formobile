"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Minus, Building2, Layers, ListChecks, ArrowUpRight } from "lucide-react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  Badge,
  Modal,
  ErrorText,
} from "@/components/ui";
import { Stagger, Item } from "@/components/motion";
import Building, { type BuildingFloor } from "@/components/Building";
import Select from "@/components/Select";
import { PROJECT_STATUS_LABEL } from "@/lib/format";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Build floor list bottom-up: basements, stilt (always present), ground,
 *  floors, terrace. */
function buildFloors(
  basements: number,
  above: number,
  terrace: boolean
): BuildingFloor[] {
  const list: { name: string; kind: "BASEMENT" | "STILT" | "FLOOR" | "TERRACE" }[] = [];
  for (let b = basements; b >= 1; b--)
    list.push({
      name: basements > 1 ? `Basement ${b}` : "Basement",
      kind: "BASEMENT",
    });
  // Stilt is a permanent part of every building.
  list.push({ name: "Stilt Floor", kind: "STILT" });
  for (let a = 0; a < above; a++) {
    list.push({ name: a === 0 ? "Ground Floor" : `${ordinal(a)} Floor`, kind: "FLOOR" });
  }
  if (terrace) list.push({ name: "Terrace", kind: "TERRACE" });
  return list.map((f, i) => ({ ...f, order: i }));
}

interface Project {
  id: string;
  name: string;
  code: string;
  clientName: string | null;
  location: string | null;
  status: string;
  expectedCompletion: string | null;
  createdAt?: string;
  _count: { floors: number; tasks: number };
}

const STATUS_TINT: Record<string, { bg: string; fg: string }> = {
  ACTIVE: { bg: "#dcfce7", fg: "#15803d" },
  PLANNING: { bg: "#dbeafe", fg: "#1d4ed8" },
  ON_HOLD: { bg: "#fef3c7", fg: "#b45309" },
  UPCOMING: { bg: "#e0f2fe", fg: "#0369a1" },
  COMPLETED: { bg: "#eef2f7", fg: "#475569" },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [role, setRole] = useState<string>("");
  const [open, setOpen] = useState(false);

  async function load() {
    const [p, me] = await Promise.all([
      api<{ projects: Project[] }>("/api/projects"),
      api<{ user: { role: string } }>("/api/auth/me"),
    ]);
    setProjects(p.projects);
    setRole(me.user?.role ?? "");
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Projects"
        subtitle={
          role === "DESIGNER"
            ? "Buildings with design tasks assigned to you"
            : role === "ONSITE"
            ? "Buildings with designs routed to your team"
            : "Buildings, floors and design scope"
        }
        action={
          role === "ADMIN" && (
            <button
              className="btn btn-primary"
              data-testid="new-project-btn"
              onClick={() => setOpen(true)}
            >
              <Plus /> New Project
            </button>
          )
        }
      />

      {!projects ? (
        <Skeleton />
      ) : projects.length === 0 ? (
        <Empty>No projects yet.</Empty>
      ) : (
        <Stagger
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 14,
          }}
        >
          {projects.map((p) => {
            const tint = STATUS_TINT[p.status] ?? STATUS_TINT.COMPLETED;
            const isNew =
              !!p.createdAt &&
              Date.now() - new Date(p.createdAt).getTime() < 2 * 24 * 3600 * 1000;
            return (
              <Item key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="card card-hover"
                  data-testid={`project-card-${p.id}`}
                  style={{
                    display: "block",
                    padding: "1.2rem 1.3rem",
                    textDecoration: "none",
                    color: "inherit",
                    height: "100%",
                    position: "relative",
                    borderTop: isNew ? "3px solid #2563eb" : undefined,
                  }}
                >
                  {isNew && (
                    <span
                      data-testid={`project-new-tag-${p.id}`}
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        letterSpacing: "0.08em",
                        padding: "0.15rem 0.45rem",
                        borderRadius: 999,
                        background: "linear-gradient(90deg,#3b82f6,#1d4ed8)",
                        color: "#fff",
                        boxShadow: "0 3px 10px -3px rgba(37,99,235,0.7)",
                      }}
                    >
                      NEW
                    </span>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          flexShrink: 0,
                          borderRadius: 11,
                          background: "linear-gradient(135deg, #1e293b, #0f172a)",
                          display: "grid",
                          placeItems: "center",
                          color: "#fff",
                        }}
                      >
                        <Building2 size={20} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>
                          {p.name}
                        </div>
                        <div className="mono" style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                          {p.code}
                        </div>
                      </div>
                    </div>
                    <Badge bg={tint.bg} fg={tint.fg} dot>
                      {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      display: "flex",
                      gap: 18,
                      fontSize: "0.82rem",
                      color: "#475569",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Layers size={15} color="#94a3b8" /> {p._count.floors} floors
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ListChecks size={15} color="#94a3b8" /> {p._count.tasks} tasks
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid #f1f5f9",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.78rem",
                      color: "#94a3b8",
                    }}
                  >
                    <span>{p.location || "—"}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Open <ArrowUpRight size={13} />
                    </span>
                  </div>
                </Link>
              </Item>
            );
          })}
        </Stagger>
      )}

      {open && (
        <NewProjectModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}

function NewProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    code: "",
    location: "",
    status: "PLANNING",
  });
  const [above, setAbove] = useState(4);
  const [basements, setBasements] = useState(1);
  const [terrace, setTerrace] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const floors = buildFloors(basements, above, terrace);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          floors: floors.map((f) => ({ name: f.name, type: f.kind })),
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New Project" wide>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>
        <div className="form-grid">
          <Field label="Project Name *">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Project Code *">
            <input className="input mono" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="ABC-001" required />
          </Field>
          <Field label="Location">
            <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(v) => set("status", v)}
              options={Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
            />
          </Field>
        </div>

        {/* Floor structure — selectable, with live building preview */}
        <div
          className="form-grid"
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid #f1f5f9",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Floor Structure</div>
            <Stepper
              label="Floors above ground"
              hint="Includes the ground floor"
              value={above}
              min={1}
              max={60}
              onChange={setAbove}
            />
            <Stepper
              label="Basement levels"
              value={basements}
              min={0}
              max={5}
              onChange={setBasements}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: "0.85rem",
                color: "#1e293b",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#eef2f7",
                  color: "#475569",
                  borderRadius: 999,
                  padding: "0.2rem 0.6rem",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                }}
              >
                Stilt floor · always included
              </span>
            </div>
            <Toggle
              label="Terrace"
              hint="Rooftop level with its own drawing set"
              checked={terrace}
              onChange={setTerrace}
            />
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              <span className="mono" style={{ fontWeight: 700, color: "#0f172a" }}>
                {floors.length}
              </span>{" "}
              floors will be created automatically.
            </div>
          </div>

          <div
            style={{
              maxHeight: 280,
              overflowY: "auto",
              padding: "8px 4px",
              borderRadius: 12,
              background: "linear-gradient(180deg,#f8fafc,#eef2f7)",
              border: "1px solid #e6ebf2",
            }}
          >
            <div style={{ transform: "scale(0.78)", transformOrigin: "top center" }}>
              <Building floors={floors} interactive={false} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />}
            {saving ? "Creating…" : "Create Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={{ padding: "0.45rem 0.6rem" }}
        >
          <Minus size={15} />
        </button>
        <span
          className="mono"
          style={{ minWidth: 34, textAlign: "center", fontSize: "1.1rem", fontWeight: 700 }}
        >
          {value}
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={{ padding: "0.45rem 0.6rem" }}
        >
          <Plus size={15} />
        </button>
        {hint && <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>{hint}</span>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span
        aria-checked={checked}
        role="switch"
        style={{
          width: 38,
          height: 22,
          borderRadius: 999,
          flexShrink: 0,
          background: checked
            ? "linear-gradient(90deg,#3b82f6,#1d4ed8)"
            : "#dbe3ee",
          position: "relative",
          transition: "background 0.2s ease",
          boxShadow: checked ? "0 4px 10px -3px rgba(37,99,235,0.5)" : "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 1px 3px rgba(15,23,42,0.3)",
            transition: "left 0.2s ease",
          }}
        />
      </span>
      <span>
        <span style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}>
          {label}
        </span>
        {hint && (
          <span style={{ display: "block", fontSize: "0.72rem", color: "#94a3b8" }}>{hint}</span>
        )}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
