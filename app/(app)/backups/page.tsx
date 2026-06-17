"use client";

import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, Download, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

interface Backup {
  id: string;
  dateKey: string;
  trigger: string;
  status: string;
  filename: string;
  sizeBytes: number;
  stats: Record<string, number> | null;
  inDb: boolean;
  error: string | null;
  createdAt: string;
}

function fmtSize(b: number): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

const STATUS_TINT: Record<string, { bg: string; fg: string }> = {
  complete: { bg: "#dcfce7", fg: "#15803d" },
  running: { bg: "#fef3c7", fg: "#b45309" },
  failed: { bg: "#fee2e2", fg: "#b91c1c" },
};

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const r = await fetch("/api/admin/backups");
    if (!r.ok) {
      setErr(r.status === 403 ? "Admins only." : "Failed to load backups.");
      setBackups([]);
      setLoading(false);
      return;
    }
    const d = await r.json();
    setBackups(d.backups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/backups", { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(d.error || "Backup failed.");
      } else {
        await load();
      }
    } finally {
      setRunning(false);
    }
  }

  const lastGood = backups.find((b) => b.status === "complete");

  return (
    <div data-testid="backups-page" style={{ maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h1 className="display" style={{ fontSize: "clamp(1.5rem,4vw,2rem)", marginBottom: 4 }}>
            Database backups
          </h1>
          <div style={{ fontSize: "0.86rem", color: "#64748b" }}>
            Automatic full backup every day at midnight · kept for 14 days · stored in the
            database and on disk.
          </div>
        </div>
        <button
          className="btn btn-primary"
          data-testid="run-backup-btn"
          onClick={runNow}
          disabled={running}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <RefreshCw size={16} className={running ? "spin" : ""} />
          {running ? "Backing up…" : "Back up now"}
        </button>
      </div>

      {/* status banner */}
      <div
        className="card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "1rem 1.1rem",
          marginBottom: 16,
        }}
      >
        {lastGood ? (
          <>
            <ShieldCheck size={22} color="#15803d" />
            <div>
              <div style={{ fontWeight: 600 }}>Protected</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }} data-testid="last-backup">
                Latest backup: {fmtDateTime(lastGood.createdAt)} · {fmtSize(lastGood.sizeBytes)}
              </div>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle size={22} color="#b45309" />
            <div>
              <div style={{ fontWeight: 600 }}>No backup yet</div>
              <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
                Run one now, or wait for the nightly schedule.
              </div>
            </div>
          </>
        )}
      </div>

      {err && (
        <div
          data-testid="backups-error"
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
            padding: "0.7rem 1rem",
            borderRadius: 10,
            marginBottom: 14,
            fontSize: "0.85rem",
          }}
        >
          {err}
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>Loading…</div>
        ) : backups.length === 0 ? (
          <div
            data-testid="backups-empty"
            style={{ padding: "2.5rem", textAlign: "center", color: "#94a3b8" }}
          >
            <DatabaseBackup size={26} style={{ opacity: 0.5, marginBottom: 8 }} />
            <div>No backups recorded yet.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#94a3b8", fontSize: "0.72rem", letterSpacing: "0.06em" }}>
                  <th style={{ padding: "0.7rem 1.1rem", fontWeight: 600 }}>WHEN</th>
                  <th style={{ padding: "0.7rem 0.6rem", fontWeight: 600 }}>TYPE</th>
                  <th style={{ padding: "0.7rem 0.6rem", fontWeight: 600 }}>STATUS</th>
                  <th style={{ padding: "0.7rem 0.6rem", fontWeight: 600 }}>SIZE</th>
                  <th style={{ padding: "0.7rem 0.6rem", fontWeight: 600 }}>RECORDS</th>
                  <th style={{ padding: "0.7rem 1.1rem", fontWeight: 600, textAlign: "right" }}>FILE</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const tint = STATUS_TINT[b.status] ?? STATUS_TINT.running;
                  const records = b.stats
                    ? Object.values(b.stats).reduce((a, n) => a + (n || 0), 0)
                    : 0;
                  return (
                    <tr key={b.id} data-testid={`backup-row-${b.id}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.75rem 1.1rem", fontWeight: 500 }}>
                        {fmtDateTime(b.createdAt)}
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem", textTransform: "capitalize", color: "#64748b" }}>
                        {b.trigger}
                      </td>
                      <td style={{ padding: "0.75rem 0.6rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "0.14rem 0.5rem",
                            borderRadius: 999,
                            background: tint.bg,
                            color: tint.fg,
                            textTransform: "capitalize",
                          }}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="mono" style={{ padding: "0.75rem 0.6rem", color: "#475569" }}>
                        {fmtSize(b.sizeBytes)}
                      </td>
                      <td className="mono" style={{ padding: "0.75rem 0.6rem", color: "#475569" }}>
                        {records || "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1.1rem", textAlign: "right" }}>
                        {b.status === "complete" ? (
                          <a
                            className="btn btn-ghost"
                            data-testid={`download-backup-${b.id}`}
                            href={`/api/admin/backups/${b.id}/download`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0.3rem 0.7rem" }}
                          >
                            <Download size={14} /> Download
                          </a>
                        ) : b.error ? (
                          <span style={{ color: "#b91c1c", fontSize: "0.78rem" }} title={b.error}>
                            error
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 14, lineHeight: 1.6 }}>
        Backups are stored as a gzipped snapshot inside the database (durable) and copied to the
        server&apos;s backup folder. To restore from a backup, contact your administrator — restore
        is performed manually for safety.
      </div>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
