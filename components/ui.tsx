"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DraftingCompass, X, Upload, UserCheck, CalendarDays } from "lucide-react";
import { STATUS_LABEL, statusStyle, priorityStyle, fmtDateTime } from "@/lib/format";
import { CountUp, EASE } from "@/components/motion";

export function PageHeader({
  title,
  subtitle,
  eyebrow = "Blueprint Flow",
  action,
}: {
  title: React.ReactNode;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: "1.7rem",
        flexWrap: "wrap",
      }}
    >
      <div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="eyebrow"
          style={{ marginBottom: 8 }}
        >
          {eyebrow}
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
          className="page-title"
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            style={{ color: "#64748b", fontSize: "0.92rem", marginTop: 8, marginBottom: 0 }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {action}
        </motion.div>
      )}
    </div>
  );
}

export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          objectFit: "cover",
          border: "1px solid rgba(15,23,42,0.08)",
          background: "#e2e8f0",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        background: "linear-gradient(135deg, #475569, #1e293b)",
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {initials}
    </div>
  );
}

export function Badge({
  bg,
  fg,
  dot,
  children,
}: {
  bg: string;
  fg: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span className="badge" style={{ background: bg, color: fg }}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = statusStyle(status);
  return (
    <Badge bg={s.bg} fg={s.fg} dot>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const s = priorityStyle(priority);
  return (
    <Badge bg={s.bg} fg={s.fg}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </Badge>
  );
}

export function StatCard({
  label,
  value,
  accent,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  accent?: string;
  icon?: React.ReactNode;
  tint?: string;
}) {
  const color = accent ?? "#0f172a";
  return (
    <div
      className="card card-hover"
      style={{
        padding: "1.15rem 1.25rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* corner arc — drafting flourish */}
      <svg
        aria-hidden
        width={74}
        height={74}
        style={{ position: "absolute", top: -10, right: -10, opacity: 0.55 }}
        fill="none"
      >
        <circle cx={74} cy={0} r={56} stroke="#eef2f8" strokeWidth={1.5} />
        <circle cx={74} cy={0} r={40} stroke="#f2f5fa" strokeWidth={1.5} />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            color: "#64748b",
            fontWeight: 650,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              display: "grid",
              placeItems: "center",
              background: tint ?? "#f1f5f9",
              color: accent ?? "#475569",
              boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.04)",
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: "2.15rem",
          fontWeight: 750,
          letterSpacing: "-0.02em",
          color,
          lineHeight: 1,
          position: "relative",
        }}
      >
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent ?? "#cbd5e1"}, transparent 70%)`,
          opacity: accent ? 0.5 : 0.35,
        }}
      />
    </div>
  );
}

/** Who uploads, who reviews, and the deadline — fully visible (wraps, never
 *  truncates) so every dashboard shows the same clear picture. */
export function TaskPeople({
  assignees,
  reviewer,
  deadline,
}: {
  assignees: string[];
  reviewer: string | null;
  deadline?: string | null;
}) {
  const line: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 6,
    fontSize: "0.78rem",
    color: "#64748b",
    lineHeight: 1.45,
  };
  const icon: React.CSSProperties = { flexShrink: 0, marginTop: 3, color: "#94a3b8" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4, minWidth: 0 }}>
      <span style={line}>
        <Upload size={12} style={icon} />
        <span style={{ overflowWrap: "anywhere" }}>
          <b style={{ color: "#475569", fontWeight: 600 }}>
            {assignees.length ? assignees.join(", ") : "Unassigned"}
          </b>{" "}
          uploads
        </span>
      </span>
      <span style={line}>
        <UserCheck size={12} style={icon} />
        <span style={{ overflowWrap: "anywhere" }}>
          <b style={{ color: "#475569", fontWeight: 600 }}>
            {reviewer ?? "Any off-site member"}
          </b>{" "}
          reviews on site
        </span>
      </span>
      {deadline && (
        <span style={line}>
          <CalendarDays size={12} style={icon} />
          <span>due {fmtDateTime(deadline)}</span>
        </span>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
      style={{
        padding: "3.8rem 1rem",
        textAlign: "center",
        color: "#94a3b8",
        fontSize: "0.92rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        borderStyle: "dashed",
        borderColor: "#d8e0ec",
        background:
          "linear-gradient(180deg,#fff,#fcfdff), radial-gradient(60% 60% at 50% 0%, rgba(37,99,235,0.04), transparent)",
      }}
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: "linear-gradient(135deg,#eef2f9,#e3eaf5)",
          display: "grid",
          placeItems: "center",
          color: "#8da3c0",
          boxShadow: "inset 0 1px 0 #fff, var(--shadow-sm)",
        }}
      >
        <DraftingCompass width={26} height={26} strokeWidth={1.6} />
      </motion.div>
      <div style={{ fontWeight: 600, color: "#64748b" }}>{children}</div>
      <div style={{ fontSize: "0.78rem", color: "#b3bfd0" }}>
        Nothing on the drawing board here yet.
      </div>
    </motion.div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 62, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Portal to <body>: page content lives inside stacking contexts (sticky
  // topbar, .app-content) that would otherwise paint over the backdrop.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock background scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.5)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 90,
          }}
        >
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              width: "100%",
              maxWidth: wide ? 660 : 470,
              padding: "1.6rem",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: "1.15rem",
                paddingBottom: "0.85rem",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <h2
                className="display"
                style={{
                  fontSize: "1.3rem",
                  letterSpacing: "-0.015em",
                  margin: 0,
                }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  border: "1px solid var(--color-line)",
                  background: "#fff",
                  borderRadius: 9,
                  width: 30,
                  height: 30,
                  display: "grid",
                  placeItems: "center",
                  cursor: "pointer",
                  color: "#64748b",
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      style={{
        background: "#fef2f2",
        color: "#b91c1c",
        padding: "0.55rem 0.75rem",
        borderRadius: 9,
        fontSize: "0.82rem",
        marginBottom: "0.85rem",
        border: "1px solid #fecaca",
        overflow: "hidden",
      }}
    >
      {children}
    </motion.div>
  );
}

/** Tiny client fetch helper that throws on non-2xx with the API error text. */
export async function api<T = unknown>(
  url: string,
  opts?: RequestInit
): Promise<T> {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((data as { error?: string }).error || "Request failed");
  return data as T;
}
