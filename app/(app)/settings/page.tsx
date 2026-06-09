"use client";

import { useEffect, useState } from "react";
import { api, PageHeader, Skeleton, Badge, ErrorText } from "@/components/ui";

interface Spec {
  id: string;
  name: string;
}
interface Category {
  id: string;
  name: string;
  specialization: { id: string; name: string } | null;
}

export default function SettingsPage() {
  const [specs, setSpecs] = useState<Spec[] | null>(null);
  const [cats, setCats] = useState<Category[] | null>(null);
  const [newSpec, setNewSpec] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newCatSpec, setNewCatSpec] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [s, c] = await Promise.all([
      api<{ specializations: Spec[] }>("/api/specializations"),
      api<{ categories: Category[] }>("/api/categories"),
    ]);
    setSpecs(s.specializations);
    setCats(c.categories);
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
  async function addCat() {
    if (!newCat.trim()) return;
    setError("");
    try {
      await api("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCat, specializationId: newCatSpec || null }),
      });
      setNewCat("");
      setNewCatSpec("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Configure specializations and design categories"
      />
      <ErrorText>{error}</ErrorText>

      <div className="r-2">
        {/* Specializations */}
        <div className="card" style={{ padding: "1.2rem" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Specializations</div>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: 12 }}>
            On-site teams (Electrical, Plumbing, etc.). Designs route to the
            matching team.
          </p>
          {!specs ? (
            <Skeleton rows={3} />
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

        {/* Categories */}
        <div className="card" style={{ padding: "1.2rem" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Design Categories</div>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: 12 }}>
            Types of design tasks. Link to a specialization to auto-route reviews.
          </p>
          {!cats ? (
            <Skeleton rows={3} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cats.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.45rem 0.6rem",
                    background: "#f8fafc",
                    borderRadius: 7,
                    fontSize: "0.85rem",
                  }}
                >
                  <span>{c.name}</span>
                  {c.specialization && (
                    <Badge bg="#eef2ff" fg="#4338ca">{c.specialization.name}</Badge>
                  )}
                </div>
              ))}
              {cats.length === 0 && (
                <p style={{ color: "#94a3b8", fontSize: "0.82rem" }}>None yet.</p>
              )}
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 6 }}>
            <input
              className="input"
              placeholder="e.g. Electrical Design"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
            />
            <select
              className="select"
              style={{ maxWidth: 150 }}
              value={newCatSpec}
              onChange={(e) => setNewCatSpec(e.target.value)}
            >
              <option value="">No team</option>
              {(specs ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={addCat}>Add</button>
          </div>
        </div>
      </div>
    </>
  );
}
