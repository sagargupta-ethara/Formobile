"use client";

import { useEffect, useState } from "react";
import { api, PageHeader, Skeleton, Badge, ErrorText } from "@/components/ui";

interface Spec {
  id: string;
  name: string;
}

// Global settings now hold only the firm-wide team specializations.
// Drawing registers are configured per project: Project → Settings tab.
export default function SettingsPage() {
  const [specs, setSpecs] = useState<Spec[] | null>(null);
  const [newSpec, setNewSpec] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const s = await api<{ specializations: Spec[] }>("/api/specializations");
    setSpecs(s.specializations);
  }
  useEffect(() => {
    load();
  }, []);

  async function addSpec() {
    if (!newSpec.trim()) return;
    setError("");
    try {
      await api("/api/specializations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSpec }),
      });
      setNewSpec("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle="Firm-wide team specializations — drawing registers live inside each project's Settings tab"
      />
      <ErrorText>{error}</ErrorText>

      <div className="card" style={{ padding: "1.2rem", maxWidth: 560 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Specializations</div>
        <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: 12 }}>
          On-site teams (Electrical, Plumbing, etc.). Designs route to the
          matching team for review.
        </p>
        {!specs ? (
          <Skeleton rows={2} />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {specs.map((s) => (
              <Badge key={s.id} bg="#f1f5f9" fg="#475569">{s.name}</Badge>
            ))}
            {specs.length === 0 && (
              <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>None yet.</p>
            )}
          </div>
        )}
        <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
          <input
            className="input"
            placeholder="e.g. Electrical"
            value={newSpec}
            onChange={(e) => setNewSpec(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSpec()}
          />
          <button className="btn btn-primary" onClick={addSpec}>Add</button>
        </div>
      </div>
    </>
  );
}
