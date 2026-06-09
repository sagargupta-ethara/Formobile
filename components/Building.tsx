"use client";

import { AnimatePresence, Reorder, motion } from "framer-motion";
import { GripVertical } from "lucide-react";

export interface BuildingFloor {
  id?: string;
  name: string;
  order: number; // elevation: higher = higher up
  isBasement?: boolean;
}

export interface FloorMeta {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function isBasementFloor(f: BuildingFloor) {
  return f.isBasement ?? /basement/i.test(f.name);
}

function Roof() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      style={{ width: 268, display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <div
        style={{
          width: 40,
          height: 14,
          background: "linear-gradient(180deg,#334155,#1e293b)",
          borderRadius: "4px 4px 0 0",
          marginBottom: -1,
        }}
      />
      <div
        style={{
          width: 252,
          height: 12,
          background: "linear-gradient(180deg,#1e293b,#0f172a)",
          borderRadius: "8px 8px 0 0",
        }}
      />
    </motion.div>
  );
}

function Base() {
  return (
    <div style={{ width: 240 }}>
      <div
        style={{
          width: "112%",
          marginLeft: "-6%",
          height: 10,
          background: "linear-gradient(180deg,#475569,#334155)",
          borderRadius: "0 0 6px 6px",
        }}
      />
      <div
        style={{
          width: "130%",
          marginLeft: "-15%",
          height: 4,
          marginTop: 3,
          borderRadius: 999,
          background: "#cbd5e1",
          opacity: 0.7,
        }}
      />
    </div>
  );
}

function metaColor(m?: FloorMeta): string | null {
  if (!m || m.total === 0) return null;
  if (m.rejected > 0) return "#dc2626";
  if (m.pending > 0) return "#d97706";
  if (m.approved === m.total) return "#16a34a";
  return "#64748b";
}

/**
 * Architectural elevation of a building. Floors stack from the roof down to
 * the basement, animate in like construction, and (in interactive mode) are
 * clickable to drive the floor action panel.
 */
export default function Building({
  floors,
  selectedId,
  onSelect,
  meta,
  interactive = true,
  reorderable = false,
  onReorder,
}: {
  floors: BuildingFloor[];
  selectedId?: string | null;
  onSelect?: (f: BuildingFloor) => void;
  meta?: Record<string, FloorMeta>;
  interactive?: boolean;
  reorderable?: boolean;
  onReorder?: (floors: BuildingFloor[]) => void;
}) {
  // In reorder mode the caller owns the order (top-first); otherwise sort here.
  const sorted = reorderable ? floors : [...floors].sort((a, b) => b.order - a.order);
  const firstBasementIdx = sorted.findIndex(isBasementFloor);
  const n = sorted.length;

  if (reorderable && onReorder) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Roof />
        <Reorder.Group
          axis="y"
          values={floors}
          onReorder={onReorder}
          style={{ width: 240, listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 3 }}
        >
          {sorted.map((f) => {
            const basement = isBasementFloor(f);
            const isGround = /ground/i.test(f.name);
            return (
              <Reorder.Item
                key={f.id ?? f.name}
                value={f}
                whileDrag={{ scale: 1.04, boxShadow: "var(--shadow-lg)", zIndex: 5 }}
                style={{
                  height: isGround ? 50 : basement ? 38 : 44,
                  padding: "0 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "grab",
                  border: "1px solid #cdd7e5",
                  borderRadius: 6,
                  background: basement
                    ? "repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 6px,#eef2f7 6px,#eef2f7 12px)"
                    : "linear-gradient(180deg,#ffffff,#f1f5f9)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <GripVertical size={15} color="#94a3b8" />
                <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "#334155", whiteSpace: "nowrap" }}>
                  {f.name}
                </span>
                <span style={{ display: "flex", gap: 5, flex: 1, justifyContent: "flex-end" }}>
                  {!basement &&
                    Array.from({ length: 3 }).map((_, w) => (
                      <span
                        key={w}
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 2,
                          background: "#dbe3ee",
                          border: "1px solid #c7d2e0",
                        }}
                      />
                    ))}
                </span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        <Base />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* sky / roof cap */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        style={{ width: 268, display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {/* rooftop unit */}
        <div
          style={{
            width: 40,
            height: 14,
            background: "linear-gradient(180deg,#334155,#1e293b)",
            borderRadius: "4px 4px 0 0",
            marginBottom: -1,
          }}
        />
        {/* parapet */}
        <div
          style={{
            width: 252,
            height: 12,
            background: "linear-gradient(180deg,#1e293b,#0f172a)",
            borderRadius: "8px 8px 0 0",
          }}
        />
      </motion.div>

      <div style={{ width: 240, display: "flex", flexDirection: "column" }}>
        <AnimatePresence initial={false}>
          {sorted.map((f, i) => {
            const basement = isBasementFloor(f);
            const selected = !!f.id && f.id === selectedId;
            const key = f.id ?? `${f.name}-${f.order}`;
            const c = metaColor(meta && f.id ? meta[f.id] : undefined);
            const isGround = /ground/i.test(f.name);
            const delay = (n - 1 - i) * 0.05; // build bottom-to-top
            return (
              <div key={key}>
                {i === firstBasementIdx && firstBasementIdx > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      margin: "2px 0 4px",
                      color: "#94a3b8",
                      fontSize: "0.6rem",
                      letterSpacing: "0.12em",
                    }}
                  >
                    <span style={{ flex: 1, height: 1, background: "#cbd5e1" }} />
                    GROUND
                    <span style={{ flex: 1, height: 1, background: "#cbd5e1" }} />
                  </div>
                )}
                <motion.button
                  layout
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && onSelect?.(f)}
                  initial={{ opacity: 0, y: 22, scaleY: 0.6 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.4, height: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay }}
                  whileHover={interactive ? { x: 4 } : undefined}
                  style={{
                    transformOrigin: "bottom",
                    position: "relative",
                    width: "100%",
                    height: isGround ? 56 : basement ? 38 : 44,
                    marginBottom: 3,
                    padding: "0 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    cursor: interactive ? "pointer" : "default",
                    border: selected ? "2px solid #2563eb" : "1px solid #cdd7e5",
                    borderRadius: 6,
                    background: selected
                      ? "linear-gradient(180deg,#eff6ff,#dbeafe)"
                      : basement
                      ? "repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 6px,#eef2f7 6px,#eef2f7 12px)"
                      : "linear-gradient(180deg,#ffffff,#f1f5f9)",
                    boxShadow: selected
                      ? "0 8px 22px -8px rgba(37,99,235,0.5)"
                      : "var(--shadow-sm)",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: selected ? "#1d4ed8" : "#334155",
                      whiteSpace: "nowrap",
                      zIndex: 1,
                    }}
                  >
                    {f.name}
                  </span>

                  {/* windows */}
                  <span style={{ display: "flex", gap: 5, flex: 1, justifyContent: "center" }}>
                    {!isGround &&
                      !basement &&
                      Array.from({ length: 4 }).map((_, w) => (
                        <span
                          key={w}
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 2,
                            background:
                              (i + w) % 3 === 0
                                ? "linear-gradient(135deg,#bfdbfe,#93c5fd)"
                                : "#dbe3ee",
                            border: "1px solid #c7d2e0",
                          }}
                        />
                      ))}
                    {isGround && (
                      <span
                        style={{
                          width: 18,
                          height: 30,
                          borderRadius: "3px 3px 0 0",
                          background: "linear-gradient(180deg,#93c5fd,#3b82f6)",
                          border: "1px solid #2563eb",
                          alignSelf: "flex-end",
                        }}
                      />
                    )}
                  </span>

                  {/* status dot + label tag when selected */}
                  <span style={{ display: "flex", alignItems: "center", gap: 6, zIndex: 1 }}>
                    {c && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: c,
                          boxShadow: `0 0 0 3px ${c}22`,
                        }}
                      />
                    )}
                  </span>
                </motion.button>
              </div>
            );
          })}
        </AnimatePresence>

        {/* ground base / footing */}
        <motion.div
          layout
          style={{
            width: "112%",
            marginLeft: "-6%",
            height: 10,
            background: "linear-gradient(180deg,#475569,#334155)",
            borderRadius: "0 0 6px 6px",
          }}
        />
        <div
          style={{
            width: "130%",
            marginLeft: "-15%",
            height: 4,
            marginTop: 3,
            borderRadius: 999,
            background: "#cbd5e1",
            opacity: 0.7,
          }}
        />
      </div>
    </div>
  );
}
