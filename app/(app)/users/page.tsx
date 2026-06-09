"use client";

import { useEffect, useState } from "react";
import {
  api,
  PageHeader,
  Skeleton,
  Empty,
  Badge,
  Modal,
  ErrorText,
} from "@/components/ui";
import { fmtDate } from "@/lib/format";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
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
        title="Team"
        subtitle="Designers, on-site reviewers and admins"
        action={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + New User
          </button>
        }
      />

      {!users ? (
        <Skeleton />
      ) : users.length === 0 ? (
        <Empty>No users yet.</Empty>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {users.map((u, i) => (
            <div
              key={u.id}
              className="user-row"
              style={{
                padding: "0.85rem 1.1rem",
                borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{u.name}</div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                  {u.email}
                  {u.phone ? ` · ${u.phone}` : ""}
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
              <button
                className="btn btn-ghost"
                onClick={() => toggle(u)}
                style={{ justifySelf: "end" }}
              >
                <Badge
                  bg={u.status === "ACTIVE" ? "#dcfce7" : "#fee2e2"}
                  fg={u.status === "ACTIVE" ? "#15803d" : "#b91c1c"}
                >
                  {u.status === "ACTIVE" ? "Active" : "Inactive"}
                </Badge>
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (
        <NewUserModal
          specs={specs}
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

function NewUserModal({
  specs,
  onClose,
  onCreated,
}: {
  specs: Spec[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "DESIGNER",
    specializationId: "",
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
      await api("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          specializationId: form.specializationId || null,
        }),
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="New User" wide>
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
            <select className="select" value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="DESIGNER">Designer</option>
              <option value="ONSITE">On-Site Reviewer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>
          <Field label="Specialization">
            <select className="select" value={form.specializationId} onChange={(e) => set("specializationId", e.target.value)}>
              <option value="">None</option>
              {specs.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Password *">
            <input className="input" type="text" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="min 6 chars" required />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Creating…" : "Create User"}
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
