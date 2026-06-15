"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  Badge,
  Modal,
  ErrorText,
  Avatar,
} from "@/components/ui";
import { fmtDate } from "@/lib/format";
import Select from "@/components/Select";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  status: string;
  specialization: { id: string; name: string } | null;
  createdAt: string;
}
interface Spec {
  id: string;
  name: string;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  DESIGNER: "Designer",
  ONSITE: "On-Site",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  async function load() {
    const [u, s] = await Promise.all([
      api<{ users: User[] }>("/api/users"),
      api<{ specializations: Spec[] }>("/api/specializations"),
    ]);
    setUsers(u.users);
    setSpecs(s.specializations);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(u: User) {
    await api(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    });
    load();
  }

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Team"
        subtitle="Designers, on-site reviewers and admins"
        action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus /> New User
          </button>
        }
      />

      {!users ? (
        <Skeleton />
      ) : users.length === 0 ? (
        <Empty>No users yet.</Empty>
      ) : (
        // grouped by department
        [...users
          .reduce((m, u) => {
            const key =
              u.department ?? (ROLE_LABEL[u.role] ? `${ROLE_LABEL[u.role]}s` : "Other");
            if (!m.has(key)) m.set(key, []);
            m.get(key)!.push(u);
            return m;
          }, new Map<string, User[]>())
          .entries()].map(([dept, list]) => (
        <div key={dept} className="card" style={{ overflow: "hidden", marginBottom: 14 }}>
          <div
            className="user-row list-head"
            style={{ padding: "0.6rem 1.1rem" }}
          >
            <span>{dept}</span>
            <span>Role</span>
            <span>Joined</span>
            <span style={{ textAlign: "right" }}>Status</span>
          </div>
          {list.map((u, i) => (
            <div
              key={u.id}
              className="user-row row-link"
              style={{
                padding: "0.85rem 1.1rem",
                borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <Avatar name={u.name} size={36} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.name}</div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "#94a3b8",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Badge bg="#eef2ff" fg="#4338ca">{ROLE_LABEL[u.role]}</Badge>
                {u.specialization && (
                  <Badge bg="#f1f5f9" fg="#475569">{u.specialization.name}</Badge>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Joined {fmtDate(u.createdAt)}
              </div>
              <div style={{ display: "flex", gap: 6, justifySelf: "end", alignItems: "center" }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setEditing(u)}
                  title="Edit user"
                  style={{ padding: "0.45rem 0.6rem" }}
                >
                  <Pencil size={14} />
                </button>
                <button className="btn btn-ghost" onClick={() => toggle(u)}>
                  <Badge
                    bg={u.status === "ACTIVE" ? "#dcfce7" : "#fee2e2"}
                    fg={u.status === "ACTIVE" ? "#15803d" : "#b91c1c"}
                  >
                    {u.status === "ACTIVE" ? "Active" : "Inactive"}
                  </Badge>
                </button>
              </div>
            </div>
          ))}
        </div>
        ))
      )}

      {(open || editing) && (
        <UserModal
          user={editing}
          specs={specs}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setOpen(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

/** Create + edit in one dialog — every field is modifiable, including the
 *  password (admin reset: leave blank on edit to keep the current one). */
function UserModal({
  user,
  specs,
  onClose,
  onSaved,
}: {
  user: User | null;
  specs: Spec[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!user;
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    role: user?.role ?? "DESIGNER",
    department: user?.department ?? "",
    specializationId: user?.specialization?.id ?? "",
    password: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        ...form,
        specializationId: form.specializationId || null,
      };
      if (editing && !form.password) delete body.password;
      await api(editing ? `/api/users/${user!.id}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editing ? `Edit — ${user!.name}` : "New User"} wide>
      <form onSubmit={submit}>
        <ErrorText>{error}</ErrorText>
        <div className="form-grid">
          <Field label="Name *">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Email *">
            <input className="input" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Role *">
            <Select
              value={form.role}
              onChange={(v) => set("role", v)}
              options={[
                { value: "DESIGNER", label: "Designer" },
                { value: "ONSITE", label: "On-Site Reviewer" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
          </Field>
          <Field label="Department">
            <Select
              value={form.department}
              onChange={(v) => set("department", v)}
              placeholder="Pick or type a new department…"
              creatable
              options={[
                "Interior Design",
                "Architecture · Structure",
                "Site Head",
                "Site Supervisor",
                "Carpentry",
                "MEP · Plumbing",
                "MEP · Electrical",
                "MEP · HVAC",
                "Admin",
              ].map((d) => ({ value: d, label: d }))}
            />
          </Field>
          <Field label="Specialization">
            <Select
              value={form.specializationId}
              onChange={(v) => set("specializationId", v)}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...specs.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </Field>
          <Field label={editing ? "Reset Password" : "Password *"}>
            <input
              className="input"
              type="text"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={editing ? "leave blank to keep current" : "min 6 chars"}
              required={!editing}
            />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save Changes" : "Create User"}
          </button>
        </div>
      </form>
    </Modal>
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
