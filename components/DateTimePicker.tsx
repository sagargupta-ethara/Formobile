"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar as CalIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/format";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

interface Parsed {
  y: number;
  m: number;
  d: number;
  h: number;
  min: number;
}

/** Parse our own value formats locally (avoid UTC day-shift of new Date("Y-M-D")). */
function parseValue(value?: string): Parsed | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return {
    y: +m[1],
    m: +m[2] - 1,
    d: +m[3],
    h: m[4] ? +m[4] : 9,
    min: m[5] ? +m[5] : 0,
  };
}

export default function DateTimePicker({
  value,
  onChange,
  mode = "date",
  placeholder = "Select date",
}: {
  value: string;
  onChange: (v: string) => void;
  mode?: "date" | "datetime";
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const init = parseValue(value);

  const [view, setView] = useState(() =>
    init ? { y: init.y, m: init.m } : { y: now.getFullYear(), m: now.getMonth() }
  );
  const [sel, setSel] = useState<{ y: number; m: number; d: number } | null>(() =>
    init ? { y: init.y, m: init.m, d: init.d } : null
  );
  const [h, setH] = useState(() => (init ? init.h : 9));
  const [min, setMin] = useState(() => (init ? init.min : 0));

  // resync from the value whenever the picker opens
  useEffect(() => {
    if (!open) return;
    const p = parseValue(value);
    const base = p ?? {
      y: now.getFullYear(),
      m: now.getMonth(),
      d: now.getDate(),
      h: 9,
      min: 0,
    };
    setView({ y: base.y, m: base.m });
    setSel(p ? { y: p.y, m: p.m, d: p.d } : null);
    setH(base.h);
    setMin(base.min);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function emit(s: typeof sel, hh: number, mm: number) {
    if (!s) {
      onChange("");
      return;
    }
    const datePart = `${s.y}-${pad(s.m + 1)}-${pad(s.d)}`;
    onChange(mode === "datetime" ? `${datePart}T${pad(hh)}:${pad(mm)}` : datePart);
  }

  function pickDay(d: number) {
    const s = { y: view.y, m: view.m, d };
    setSel(s);
    if (mode === "date") {
      emit(s, h, min);
      setOpen(false);
    } else {
      emit(s, h, min);
    }
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const nm = v.m + delta;
      return { y: v.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  }

  function setTime(nh: number, nm: number) {
    setH(nh);
    setMin(nm);
    if (sel) emit(sel, nh, nm);
  }

  function chooseToday() {
    const s = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    setView({ y: s.y, m: s.m });
    setSel(s);
    emit(s, h, min);
    if (mode === "date") setOpen(false);
  }

  // calendar grid
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];

  const display = value
    ? mode === "datetime"
      ? fmtDateTime(value)
      : fmtDate(value)
    : "";

  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "AM" : "PM";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="input"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: "pointer",
          textAlign: "left",
          color: display ? "#0f172a" : "#aab6c6",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {display || placeholder}
        </span>
        <CalIcon size={16} color="#94a3b8" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
              background: "rgba(15,23,42,0.5)",
              backdropFilter: "blur(4px)",
              display: "grid",
              placeItems: "center",
              padding: "1rem",
            }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="card"
              style={{ width: "100%", maxWidth: 320, padding: "1.1rem", boxShadow: "var(--shadow-lg)" }}
            >
              {/* header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <button type="button" className="btn btn-ghost" style={{ padding: "0.4rem" }} onClick={() => shiftMonth(-1)}>
                  <ChevronLeft size={16} />
                </button>
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>
                  {MONTHS[view.m]} {view.y}
                </div>
                <button type="button" className="btn btn-ghost" style={{ padding: "0.4rem" }} onClick={() => shiftMonth(1)}>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* weekday labels */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
                {WEEKDAYS.map((w) => (
                  <div key={w} style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 600, color: "#94a3b8" }}>
                    {w}
                  </div>
                ))}
              </div>

              {/* day grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                {cells.map((d, i) => {
                  if (d === null) return <div key={i} />;
                  const isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
                  const isToday =
                    now.getFullYear() === view.y && now.getMonth() === view.m && now.getDate() === d;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickDay(d)}
                      style={{
                        height: 36,
                        borderRadius: 8,
                        border: isToday && !isSel ? "1px solid #cdd7e5" : "1px solid transparent",
                        background: isSel ? "linear-gradient(180deg,#1e293b,#0f172a)" : "transparent",
                        color: isSel ? "#fff" : "#334155",
                        fontSize: "0.82rem",
                        fontWeight: isSel ? 700 : 500,
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel) e.currentTarget.style.background = "#f1f5f9";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {/* time picker */}
              {mode === "datetime" && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid #f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                  }}
                >
                  <Clock size={16} color="#94a3b8" />
                  <TimeWheel
                    label={pad(hour12)}
                    onUp={() => setTime((h + 1) % 24, min)}
                    onDown={() => setTime((h + 23) % 24, min)}
                  />
                  <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>:</span>
                  <TimeWheel
                    label={pad(min)}
                    onUp={() => setTime(h, (min + 5) % 60)}
                    onDown={() => setTime(h, (min + 55) % 60)}
                  />
                  <button
                    type="button"
                    onClick={() => setTime((h + 12) % 24, min)}
                    className="btn btn-ghost"
                    style={{ padding: "0.4rem 0.6rem", fontWeight: 700 }}
                  >
                    {ampm}
                  </button>
                </div>
              )}

              {/* actions */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: "0.8rem" }}
                  onClick={() => {
                    onChange("");
                    setSel(null);
                    setOpen(false);
                  }}
                >
                  <X size={14} /> Clear
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: "0.8rem" }} onClick={chooseToday}>
                    Today
                  </button>
                  <button type="button" className="btn btn-primary" style={{ fontSize: "0.8rem" }} onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function TimeWheel({
  label,
  onUp,
  onDown,
}: {
  label: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <button type="button" onClick={onUp} style={wheelBtn}>
        <ChevronUp size={15} />
      </button>
      <span className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, width: 30, textAlign: "center" }}>
        {label}
      </span>
      <button type="button" onClick={onDown} style={wheelBtn}>
        <ChevronDown size={15} />
      </button>
    </div>
  );
}

const wheelBtn: React.CSSProperties = {
  border: "1px solid var(--color-line)",
  background: "#fff",
  borderRadius: 7,
  width: 30,
  height: 24,
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
  color: "#475569",
};
