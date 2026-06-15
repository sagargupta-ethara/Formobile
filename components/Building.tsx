"use client";

import { AnimatePresence, Reorder, motion } from "framer-motion";
import { GripVertical } from "lucide-react";

export type FloorKind = "BASEMENT" | "STILT" | "FLOOR" | "TERRACE";

export interface BuildingFloor {
  id?: string;
  name: string;
  order: number; // elevation: higher = higher up
  isBasement?: boolean;
  kind?: FloorKind;
}

export interface FloorMeta {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

const WALL = "#c3cedd";
const SLAB = "#c8d2e0";

function kindOf(f: BuildingFloor): FloorKind {
  if (f.kind) return f.kind;
  if (f.isBasement || /basement|underground|cellar/i.test(f.name)) return "BASEMENT";
  if (/stilt/i.test(f.name)) return "STILT";
  if (/terrace|rooftop/i.test(f.name)) return "TERRACE";
  return "FLOOR";
}

function isBasementFloor(f: BuildingFloor) {
  return kindOf(f) === "BASEMENT";
}

/* ------------------------------------------------------------------ *
 *  Rooftop: stair penthouse, HVAC, water tank, blinking antenna       *
 * ------------------------------------------------------------------ */
function Roof() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      style={{ width: 252, display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          padding: "0 26px",
          marginBottom: -1,
        }}
      >
        {/* stair / elevator penthouse */}
        <div
          style={{
            width: 56,
            height: 20,
            background: "linear-gradient(180deg,#3b4a63,#243249)",
            borderRadius: "4px 4px 0 0",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        />
        {/* hvac unit with vent fins */}
        <div
          style={{
            width: 34,
            height: 13,
            background: "repeating-linear-gradient(90deg,#475569 0 3px,#334155 3px 6px)",
            borderRadius: "3px 3px 0 0",
          }}
        />
        {/* water tank */}
        <div
          style={{
            width: 18,
            height: 16,
            background: "linear-gradient(180deg,#64748b,#475569)",
            borderRadius: "6px 6px 2px 2px",
          }}
        />
        {/* antenna with aviation beacon */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: "#f87171",
              boxShadow: "0 0 8px 2px rgba(248,113,113,0.7)",
              animation: "blink 1.6s ease infinite",
            }}
          />
          <span
            style={{
              width: 2,
              height: 24,
              background: "linear-gradient(180deg,#94a3b8,#334155)",
            }}
          />
        </div>
      </div>
      {/* parapet */}
      <div
        style={{
          width: "100%",
          height: 13,
          background: "linear-gradient(180deg,#243249,#0f172a)",
          borderRadius: "6px 6px 0 0",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
        }}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 *  Footing slab + grade line with soil hatching                       *
 * ------------------------------------------------------------------ */
function Base() {
  const hatch: React.CSSProperties = {
    width: "150%",
    marginLeft: "-25%",
    maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
    WebkitMaskImage:
      "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)",
  };
  return (
    <div style={{ width: 240 }}>
      <div
        style={{
          width: "116%",
          marginLeft: "-8%",
          height: 11,
          background: "linear-gradient(180deg,#475569,#334155)",
          borderRadius: "0 0 4px 4px",
          boxShadow: "0 12px 26px -10px rgba(15,23,42,0.45)",
        }}
      />
      <div style={{ ...hatch, height: 2.5, marginTop: 4, background: "#64748b" }} />
      <div
        style={{
          ...hatch,
          height: 8,
          marginTop: 1,
          background:
            "repeating-linear-gradient(125deg, #b6c2d4 0 1.5px, transparent 1.5px 7px)",
        }}
      />
    </div>
  );
}

/* glazed window with mullions; occasionally lit from inside */
function Window({ lit, width = 14, height = 18 }: { lit?: boolean; width?: number; height?: number }) {
  return (
    <span
      style={{
        width,
        height,
        borderRadius: 2,
        position: "relative",
        flexShrink: 0,
        background: lit
          ? "linear-gradient(180deg,#fef3c7,#fcd34d)"
          : "linear-gradient(165deg,#e0edff 0%,#bfdbfe 45%,#93c5fd 100%)",
        border: "1px solid #9fb2c8",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(71,85,105,0.3)",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 1,
          background: "rgba(71,85,105,0.3)",
        }}
      />
    </span>
  );
}

function Windows({ seed }: { seed: number }) {
  return (
    <span style={{ display: "flex", gap: 7, flex: 1, justifyContent: "center" }}>
      {Array.from({ length: 4 }).map((_, w) => (
        <Window key={w} lit={(seed * 3 + w) % 5 === 0} />
      ))}
    </span>
  );
}

/* glass entrance: canopy + double doors flanked by storefront glazing */
function Entrance() {
  return (
    <span
      style={{
        display: "flex",
        gap: 7,
        flex: 1,
        justifyContent: "center",
        alignItems: "flex-end",
        alignSelf: "stretch",
      }}
    >
      <Window width={16} height={24} />
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            width: 48,
            height: 4,
            background: "#334155",
            borderRadius: "2px 2px 0 0",
            marginBottom: 2,
            boxShadow: "0 2px 4px rgba(15,23,42,0.25)",
          }}
        />
        <span style={{ display: "flex", gap: 1 }}>
          {[0, 1].map((d) => (
            <span
              key={d}
              style={{
                width: 13,
                height: 32,
                borderRadius: "2px 2px 0 0",
                background: "linear-gradient(180deg,#93c5fd,#3b82f6)",
                border: "1px solid #2563eb",
                borderBottom: "none",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                position: "relative",
              }}
            >
              {/* door handle */}
              <span
                style={{
                  position: "absolute",
                  top: 13,
                  [d === 0 ? "right" : "left"]: 2,
                  width: 1.5,
                  height: 7,
                  borderRadius: 999,
                  background: "#1e3a8a",
                }}
              />
            </span>
          ))}
        </span>
      </span>
      <Window width={16} height={24} />
    </span>
  );
}

/* thick grade line where the building meets the ground (above basements) */
function GradeLine() {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        width: "118%",
        marginLeft: "-9%",
        height: 4,
        background: "linear-gradient(180deg,#64748b,#475569)",
        borderRadius: 2,
        boxShadow: "0 2px 0 rgba(148,163,184,0.5)",
      }}
    />
  );
}

function metaColor(m?: FloorMeta): string | null {
  if (!m || m.total === 0) return null;
  if (m.rejected > 0) return "#dc2626";
  if (m.pending > 0) return "#d97706";
  if (m.approved === m.total) return "#16a34a";
  return "#64748b";
}

function floorBackground(opts: { selected: boolean; kind: FloorKind }) {
  if (opts.selected) return "linear-gradient(180deg,#eff6ff,#dbeafe)";
  if (opts.kind === "BASEMENT")
    return "repeating-linear-gradient(45deg,#dde4ee 0 6px,#e9eef6 6px 12px)";
  if (opts.kind === "STILT") return "linear-gradient(180deg,#f3f7fc,#e6ecf5)";
  if (opts.kind === "TERRACE") return "linear-gradient(180deg,#eaf3fd,#dce9f7)";
  return "linear-gradient(180deg,#fbfcfe,#edf1f8)";
}

/* open stilt bay: pilotis columns over the driveway */
function StiltBay() {
  return (
    <span
      style={{
        display: "flex",
        gap: 16,
        flex: 1,
        justifyContent: "center",
        alignItems: "stretch",
        alignSelf: "stretch",
        paddingTop: 8,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            borderRadius: "2px 2px 0 0",
            background: "linear-gradient(180deg,#c3cedd,#94a6bd)",
            boxShadow: "inset 1px 0 0 rgba(255,255,255,0.5)",
          }}
        />
      ))}
    </span>
  );
}

/* terrace deck: pergola, glass railing, planter */
function TerraceDeck() {
  return (
    <span
      style={{
        display: "flex",
        flex: 1,
        justifyContent: "center",
        alignItems: "flex-end",
        alignSelf: "stretch",
        gap: 12,
      }}
    >
      {/* pergola */}
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ width: 44, height: 3.5, background: "#64748b", borderRadius: 2 }} />
        <span style={{ display: "flex", gap: 9, width: 40, justifyContent: "space-between" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 3, height: 13, background: "#64748b" }} />
          ))}
        </span>
      </span>
      {/* planter */}
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            width: 12,
            height: 7,
            borderRadius: "50% 50% 0 0",
            background: "#4ade80",
            boxShadow: "0 0 0 1px rgba(22,163,74,0.4)",
          }}
        />
        <span style={{ width: 10, height: 6, background: "#94a6bd", borderRadius: "0 0 2px 2px" }} />
      </span>
      {/* glass railing */}
      <span style={{ display: "flex", alignItems: "flex-end" }}>
        <span
          style={{
            width: 46,
            height: 12,
            borderTop: "2.5px solid #64748b",
            background:
              "linear-gradient(180deg, rgba(147,197,253,0.45), rgba(147,197,253,0.1))",
            borderLeft: "1px solid #9fb2c8",
            borderRight: "1px solid #9fb2c8",
          }}
        />
      </span>
    </span>
  );
}

/**
 * Architectural elevation of a building. Floors stack flush between facade
 * walls from the roof down to the basements, animate in like construction,
 * and (in interactive mode) are clickable to drive the floor action panel.
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

  // The lowest regular storey (ground floor) gets the entrance facade —
  // stilt and terrace levels have their own look.
  const regular = sorted.filter((f) => kindOf(f) === "FLOOR");
  const entranceKey =
    regular.length > 0
      ? regular[regular.length - 1].id ?? regular[regular.length - 1].name
      : null;

  const facadeStyle: React.CSSProperties = {
    width: 240,
    display: "flex",
    flexDirection: "column",
    borderLeft: `6px solid ${WALL}`,
    borderRight: `6px solid ${WALL}`,
    background: "#eef2f7",
    boxShadow: "0 18px 40px -18px rgba(15,23,42,0.35)",
  };

  if (reorderable && onReorder) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Roof />
        <Reorder.Group
          axis="y"
          values={floors}
          onReorder={onReorder}
          style={{ ...facadeStyle, listStyle: "none", margin: 0, padding: 0 }}
        >
          {sorted.map((f, i) => {
            const kind = kindOf(f);
            const isEntrance = (f.id ?? f.name) === entranceKey;
            return (
              <Reorder.Item
                key={f.id ?? f.name}
                value={f}
                whileDrag={{ scale: 1.04, boxShadow: "var(--shadow-lg)", zIndex: 5 }}
                style={{
                  height: isEntrance ? 54 : kind === "BASEMENT" ? 38 : 46,
                  padding: "0 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "grab",
                  borderBottom: `3px solid ${SLAB}`,
                  background: floorBackground({ selected: false, kind }),
                }}
              >
                <GripVertical size={15} color="#94a3b8" />
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "#334155",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
                <span style={{ display: "flex", gap: 6, flex: 1, justifyContent: "flex-end" }}>
                  {kind === "FLOOR" &&
                    Array.from({ length: 3 }).map((_, w) => (
                      <Window key={w} width={12} height={15} lit={(i * 3 + w) % 5 === 0} />
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
      <Roof />

      <div style={facadeStyle}>
        <AnimatePresence initial={false}>
          {sorted.map((f, i) => {
            const kind = kindOf(f);
            const basement = kind === "BASEMENT";
            const selected = !!f.id && f.id === selectedId;
            const key = f.id ?? `${f.name}-${f.order}`;
            const c = metaColor(meta && f.id ? meta[f.id] : undefined);
            const isEntrance = (f.id ?? f.name) === entranceKey;
            const delay = (n - 1 - i) * 0.05; // build bottom-to-top
            const isLastAboveGrade =
              firstBasementIdx > 0 && i === firstBasementIdx - 1;
            const height = isEntrance
              ? 58
              : kind === "BASEMENT"
              ? 40
              : kind === "STILT"
              ? 52
              : kind === "TERRACE"
              ? 50
              : 46;
            return (
              <div key={key}>
                <motion.button
                  layout
                  type="button"
                  disabled={!interactive}
                  onClick={() => interactive && onSelect?.(f)}
                  initial={{ opacity: 0, y: 22, scaleY: 0.6 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, scaleY: 0.4, height: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay }}
                  whileHover={interactive ? { x: 3 } : undefined}
                  style={{
                    transformOrigin: "bottom",
                    position: "relative",
                    width: "100%",
                    height,
                    padding: "0 12px",
                    display: "flex",
                    alignItems:
                      isEntrance || kind === "TERRACE"
                        ? "flex-end"
                        : kind === "STILT"
                        ? "stretch"
                        : "center",
                    justifyContent: "space-between",
                    gap: 8,
                    cursor: interactive ? "pointer" : "default",
                    border: "none",
                    borderBottom:
                      i === n - 1 || isLastAboveGrade ? "none" : `3px solid ${SLAB}`,
                    background: floorBackground({ selected, kind }),
                    boxShadow: selected
                      ? "inset 0 0 0 2px #3b82f6, inset 0 0 18px rgba(59,130,246,0.15)"
                      : "inset 0 1px 0 rgba(255,255,255,0.55)",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 650,
                      color: selected ? "#1d4ed8" : basement ? "#64748b" : "#334155",
                      whiteSpace: "nowrap",
                      zIndex: 1,
                      alignSelf: "center",
                    }}
                  >
                    {f.name}
                  </span>

                  {/* facade for this storey */}
                  {isEntrance ? (
                    <Entrance />
                  ) : kind === "STILT" ? (
                    <StiltBay />
                  ) : kind === "TERRACE" ? (
                    <TerraceDeck />
                  ) : basement ? (
                    <span style={{ flex: 1 }} />
                  ) : (
                    <Windows seed={i} />
                  )}

                  {/* design-status beacon */}
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      zIndex: 1,
                      alignSelf: "center",
                      minWidth: 8,
                    }}
                  >
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
                {isLastAboveGrade && <GradeLine />}
              </div>
            );
          })}
        </AnimatePresence>
      </div>

      <Base />
    </div>
  );
}
