"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  /** Options sharing a group render under a section header (e.g. department). */
  group?: string;
}

/**
 * Custom dropdown to replace native <select>: styled trigger, animated
 * popover (portaled above modals), keyboard dismiss, and a search box for
 * long lists like the drawing register.
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  searchable,
  creatable,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  /** Allow typing a value that isn't in the list ("create new"). */
  creatable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  const selected =
    options.find((o) => o.value === value) ??
    (creatable && value ? { value, label: value } : null);
  const withSearch = (searchable ?? options.length > 8) || !!creatable;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.group?.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q)
    );
  }, [options, query]);

  function openPanel() {
    if (disabled) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) {
      const panelH = Math.min(320, options.length * 38 + (withSearch ? 52 : 12));
      const spaceBelow = window.innerHeight - r.bottom;
      const up = spaceBelow < panelH + 12 && r.top > panelH;
      setRect({
        top: up ? r.top - 6 : r.bottom + 6,
        left: r.left,
        width: r.width,
        up,
      });
    }
    setQuery("");
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 30);
  }

  // close on outside interaction / escape / scroll / resize
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      )
        setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // claim the Escape so a parent dialog doesn't close along with us
        e.stopPropagation();
        setOpen(false);
      }
    }
    function onScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true); // capture: beat the modal's Escape
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="input"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          textAlign: "left",
          background: "#fff",
        }}
      >
        <span
          style={{
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: selected ? "var(--color-ink)" : "#aab6c6",
          }}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={15}
          color="#94a3b8"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: rect.up ? 6 : -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: rect.up ? 4 : -4, scale: 0.985 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "fixed",
                  top: rect.up ? undefined : rect.top,
                  bottom: rect.up ? window.innerHeight - rect.top : undefined,
                  left: rect.left,
                  width: rect.width,
                  zIndex: 95,
                  background: "#fff",
                  border: "1px solid var(--color-line)",
                  borderRadius: 12,
                  boxShadow: "var(--shadow-lg)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {withSearch && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "0.55rem 0.75rem",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <Search size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search…"
                      style={{
                        border: "none",
                        outline: "none",
                        fontSize: "0.85rem",
                        width: "100%",
                        fontFamily: "inherit",
                        color: "var(--color-ink)",
                        background: "transparent",
                      }}
                    />
                  </div>
                )}
                <div style={{ maxHeight: 264, overflowY: "auto", padding: 5 }}>
                  {creatable &&
                    query.trim() &&
                    !options.some(
                      (o) => o.label.toLowerCase() === query.trim().toLowerCase()
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          onChange(query.trim());
                          setOpen(false);
                        }}
                        className="row-link"
                        style={{
                          display: "block",
                          width: "100%",
                          border: "none",
                          background: "#f0fdf4",
                          borderRadius: 8,
                          padding: "0.5rem 0.65rem",
                          fontSize: "0.85rem",
                          textAlign: "left",
                          cursor: "pointer",
                          color: "#15803d",
                          fontWeight: 600,
                        }}
                      >
                        + Create “{query.trim()}”
                      </button>
                    )}
                  {filtered.length === 0 && !creatable && (
                    <div
                      style={{
                        padding: "1rem",
                        textAlign: "center",
                        fontSize: "0.8rem",
                        color: "#94a3b8",
                      }}
                    >
                      No matches.
                    </div>
                  )}
                  {filtered.map((o, idx) => {
                    const isSel = o.value === value;
                    const newGroup =
                      o.group && (idx === 0 || filtered[idx - 1].group !== o.group);
                    return (
                      <div key={o.value}>
                        {newGroup && (
                          <div
                            style={{
                              fontSize: "0.64rem",
                              fontWeight: 700,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              color: "#94a3b8",
                              padding: "0.5rem 0.65rem 0.25rem",
                            }}
                          >
                            {o.group}
                          </div>
                        )}
                      <button
                        type="button"
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        className="row-link"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          width: "100%",
                          border: "none",
                          background: isSel ? "#eff6ff" : "transparent",
                          borderRadius: 8,
                          padding: "0.5rem 0.65rem",
                          fontSize: "0.85rem",
                          textAlign: "left",
                          cursor: "pointer",
                          color: isSel ? "#1d4ed8" : "var(--color-ink-2)",
                          fontWeight: isSel ? 600 : 450,
                        }}
                      >
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {o.label}
                          {o.hint && (
                            <span
                              style={{
                                marginLeft: 7,
                                fontSize: "0.7rem",
                                color: "#94a3b8",
                                fontWeight: 500,
                              }}
                            >
                              {o.hint}
                            </span>
                          )}
                        </span>
                        {isSel && <Check size={14} style={{ flexShrink: 0 }} />}
                      </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
