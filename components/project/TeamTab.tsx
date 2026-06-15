"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { api, Avatar, Badge, Skeleton, Empty } from "@/components/ui";
import Select from "@/components/Select";

interface Member {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
    status: string;
    specialization: { name: string } | null;
  };
}
interface Person {
  id: string;
  name: string;
  role: string;
  department: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  DESIGNER: "Designer",
  ONSITE: "On-Site",
};

/** The project's team, grouped by department, with add/remove for admins. */
export default function TeamTab({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [everyone, setEveryone] = useState<Person[]>([]);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const m = await api<{ members: Member[] }>(`/api/projects/${projectId}/members`);
    setMembers(m.members);
    if (isAdmin) {
      const u = await api<{ users: Person[] }>("/api/users");
      setEveryone(u.users.filter((x) => (x as { status?: string }).status !== "INACTIVE"));
    }
  }, [projectId, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!adding) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adding }),
      });
      setAdding("");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    if (!confirm("Remove this member from the project team?")) return;
    await api(`/api/projects/${projectId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    load();
  }

  if (!members) return <Skeleton rows={3} />;

  const memberIds = new Set(members.map((m) => m.user.id));
  const candidates = everyone.filter((p) => !memberIds.has(p.id));

  // group members by department
  const groups = new Map<string, Member[]>();
  for (const m of members) {
    const key = m.user.department ?? ROLE_LABEL[m.user.role] ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isAdmin && (
        <div className="card" style={{ padding: "1rem 1.2rem", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Select
              value={adding}
              onChange={setAdding}
              placeholder="Add a team member to this project…"
              searchable
              options={candidates.map((p) => ({
                value: p.id,
                label: p.name,
                hint: p.department ?? ROLE_LABEL[p.role],
              }))}
            />
          </div>
          <button className="btn btn-primary" disabled={!adding || busy} onClick={add}>
            <UserPlus size={15} /> Add to Project
          </button>
        </div>
      )}

      {members.length === 0 ? (
        <Empty>No one on this project yet.</Empty>
      ) : (
        [...groups.entries()].map(([dept, list]) => (
          <div key={dept} className="card" style={{ overflow: "hidden" }}>
            <div
              className="list-head"
              style={{ padding: "0.55rem 1.1rem", display: "flex", justifyContent: "space-between" }}
            >
              <span>{dept}</span>
              <span className="mono">{list.length}</span>
            </div>
            {list.map((m, i) => (
              <div
                key={m.id}
                className="row-link"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "0.7rem 1.1rem",
                  borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
                }}
              >
                <Avatar name={m.user.name} size={34} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{m.user.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.user.email}
                  </div>
                </div>
                <Badge bg="#eef2ff" fg="#4338ca">{ROLE_LABEL[m.user.role]}</Badge>
                {m.user.specialization && (
                  <Badge bg="#f1f5f9" fg="#475569">{m.user.specialization.name}</Badge>
                )}
                {isAdmin && (
                  <button
                    onClick={() => remove(m.user.id)}
                    title="Remove from project"
                    style={{
                      border: "1px solid var(--color-line)",
                      background: "#fff",
                      borderRadius: 8,
                      width: 28,
                      height: 28,
                      display: "grid",
                      placeItems: "center",
                      cursor: "pointer",
                      color: "#94a3b8",
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
