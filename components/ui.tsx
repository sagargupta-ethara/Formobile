"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Inbox } from "lucide-react";
import { STATUS_LABEL, statusStyle, priorityStyle } from "@/lib/format";
import { CountUp, EASE } from "@/components/motion";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: "1.6rem",
      }}
    >
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          style={{
            fontSize: "1.7rem",
            fontWeight: 750,
            letterSpacing: "-0.025em",
            color: "#0f172a",
            margin: 0,
          }}
        >
          {title}
        </motion.h1>
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.12 }}
          style={{
            transformOrigin: "left",
            height: 3,
            width: 46,
            borderRadius: 999,
            marginTop: 8,
            background: "linear-gradient(90deg, #3b82f6, #1e3a8a)",
          }}
        />
        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            style={{ color: "#64748b", fontSize: "0.9rem", marginTop: 10 }}
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
  return (
    <div
      className="card card-hover"
      style={{
        padding: "1.15rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: "0.76rem",
            color: "#64748b",
            fontWeight: 600,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: tint ?? "#f1f5f9",
              color: accent ?? "#475569",
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: 750,
          letterSpacing: "-0.02em",
          color: accent ?? "#0f172a",
          lineHeight: 1,
        }}
      >
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
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
        padding: "3.5rem 1rem",
        textAlign: "center",
        color: "#94a3b8",
        fontSize: "0.92rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "#f1f5f9",
          display: "grid",
          placeItems: "center",
          color: "#cbd5e1",
        }}
      >
        <Inbox width={24} height={24} />
      </div>
      {children}
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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
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
            zIndex: 60,
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
            <h2
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                marginBottom: "1.1rem",
              }}
            >
              {title}
            </h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
