"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Compass, ArrowRight, Check } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
const INTRO_MS = 3400; // how long the fullscreen skyline plays before revealing the form

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // Cinematic entrance: the skyline owns the whole screen, then sweeps left
  // (desktop) or slides away (mobile) to reveal the sign-in panel.
  const [phase, setPhase] = useState<"intro" | "split">("intro");
  const [isMobile, setIsMobile] = useState(false);
  const reduced = useReducedMotion();
  const intro = phase === "intro";

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 640px)").matches);
    if (reduced) {
      setPhase("split");
      return;
    }
    const t = setTimeout(() => setPhase("split"), INTRO_MS);
    return () => clearTimeout(t);
  }, [reduced]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setSuccess(true);
      setTimeout(() => {
        router.replace("/projects");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <>
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--color-canvas)",
      }}
    >
      {/* -------- Art panel: fullscreen intro, then the left half -------- */}
      <AnimatePresence>
      {(!isMobile || intro) && (
      <motion.div
        key="art"
        onClick={() => setPhase("split")}
        initial={false}
        animate={isMobile ? { x: 0 } : { width: intro ? "100%" : "52.5%" }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.95, ease: EASE }}
        style={{
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "#e2e8f0",
          background: "linear-gradient(155deg, #0b1220 0%, #111827 45%, #0a0f1c 100%)",
          cursor: intro ? "pointer" : "default",
          ...(isMobile
            ? { position: "fixed" as const, inset: 0, zIndex: 60 }
            : {
                position: "relative" as const,
                width: "100%",
                flexShrink: 0,
                minHeight: "100vh",
              }),
        }}
      >
        {/* blueprint grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(96,165,250,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.10) 1px, transparent 1px), linear-gradient(rgba(96,165,250,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.05) 1px, transparent 1px)",
            backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
            maskImage: "radial-gradient(130% 100% at 50% 40%, #000 35%, transparent 85%)",
          }}
        />
        {/* glow */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.45, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
          style={{
            position: "absolute",
            left: "50%",
            top: "44%",
            width: 460,
            height: 460,
            transform: "translate(-50%,-50%)",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.35), transparent 62%)",
            filter: "blur(30px)",
          }}
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, 60, 0], y: [0, -30, 0], opacity: [0.18, 0.3, 0.18] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            left: "8%",
            bottom: "14%",
            width: 340,
            height: 340,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(168,118,62,0.22), transparent 60%)",
            filter: "blur(40px)",
          }}
        />

        {/* logo */}
        <motion.div
          initial={{ opacity: 0, x: -14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "2.4rem 2.8rem",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #1e3a8a)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 8px 22px -6px rgba(37,99,235,0.7)",
            }}
          >
            <Compass size={21} color="#fff" />
          </div>
          <div>
            <div className="display" style={{ color: "#fff", fontSize: "1.1rem" }}>
              Blueprint Flow
            </div>
            <div style={{ fontSize: "0.66rem", color: "#7c8aa3", letterSpacing: "0.06em" }}>
              DESIGN · SITE · EXECUTION
            </div>
          </div>
        </motion.div>

        {/* the animated skyline */}
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "grid",
            placeItems: "center",
            padding: "0 2rem",
            minHeight: 0,
          }}
        >
          <SkylineArt />
        </div>

        {/* headline + feature chips */}
        <div style={{ position: "relative", padding: "0.5rem 2.8rem 2.4rem" }}>
          <motion.h1
            className="display"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
            style={{
              color: "#fff",
              fontSize: "2.05rem",
              lineHeight: 1.14,
              margin: 0,
              letterSpacing: "-0.015em",
            }}
          >
            From blueprint
            <br />
            to build.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            style={{ color: "#8ea2c0", fontSize: "0.92rem", margin: "10px 0 18px", maxWidth: 380 }}
          >
            One workspace for design tasks, drawing versions and on-site approvals.
          </motion.p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              "Floor-by-floor tracking",
              "Versioned drawings",
              "On-site sign-off",
            ].map((f, i) => (
              <motion.span
                key={f}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.7 + i * 0.12 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "0.74rem",
                  fontWeight: 600,
                  color: "#bcd0ec",
                  padding: "0.38rem 0.7rem",
                  borderRadius: 999,
                  background: "rgba(59,130,246,0.1)",
                  border: "1px solid rgba(96,165,250,0.25)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <Check size={12} color="#60a5fa" /> {f}
              </motion.span>
            ))}
          </div>
        </div>

      </motion.div>
      )}
      </AnimatePresence>

      {/* -------- Right: form (revealed after the intro) -------- */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "var(--color-canvas)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 26, scale: 0.97 }}
          animate={
            intro
              ? { opacity: 0, y: 26, scale: 0.97 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 0.65, ease: EASE, delay: intro ? 0 : 0.4 }}
          className="card"
          style={{ width: "100%", maxWidth: 400, padding: "2.2rem" }}
        >
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Workspace Sign-in
          </div>
          <h2 className="display" style={{ fontSize: "1.65rem", margin: 0 }}>
            Welcome back
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.88rem", marginTop: 4, marginBottom: 22 }}>
            Sign in to your workspace
          </p>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: "#fef2f2",
                  color: "#b91c1c",
                  padding: "0.55rem 0.7rem",
                  borderRadius: 9,
                  fontSize: "0.8rem",
                  marginBottom: 14,
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </motion.div>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? <span className="spinner" /> : <ArrowRight size={16} />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid #eef2f7" }}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#94a3b8",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              QUICK LOGIN · tap to fill
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { label: "Admin", email: "manish.uppal@blueprintflow.in" },
                { label: "Designer", email: "amarpreet.padam@blueprintflow.in" },
                { label: "On-Site", email: "sudama@blueprintflow.in" },
              ].map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword("password123");
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.76rem", padding: "0.4rem 0.7rem" }}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="mono" style={{ fontSize: "0.72rem", color: "#cbd5e1", marginTop: 8 }}>
              password123
            </div>
          </div>
        </motion.div>
      </div>
    </div>

    <AnimatePresence>{success && <SuccessOverlay />}</AnimatePresence>
    </>
  );
}

function SuccessOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(155deg, #0b1220, #0a0f1c)",
        color: "#fff",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <div style={{ position: "relative", width: 110, height: 110 }}>
          {/* expanding rings */}
          {[0, 1].map((i) => (
            <motion.span
              key={i}
              initial={{ scale: 0.5, opacity: 0.6 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                border: "2px solid rgba(59,130,246,0.5)",
              }}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 16 }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 999,
              background: "linear-gradient(135deg, #3b82f6, #1e3a8a)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 16px 40px -10px rgba(37,99,235,0.8)",
            }}
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 14 }}
            >
              <Check size={48} color="#fff" strokeWidth={3} />
            </motion.div>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{ textAlign: "center" }}
        >
          <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>Welcome back</div>
          <div style={{ color: "#7c8aa3", fontSize: "0.85rem", marginTop: 2 }}>
            Preparing your workspace…
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------- *
 *  Self-drafting city skyline: tower under design, working crane, *
 *  windows that come alive, beacon, clouds, compass.              *
 * -------------------------------------------------------------- */
function SkylineArt() {
  const stroke = "#7cb0ff";
  const faint = "#3b6fd4";

  // outlines draft themselves once, then the scene stays alive
  const draw = (delay: number, dur = 1.4) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 0.95 },
    transition: {
      pathLength: { duration: dur, ease: EASE, delay },
      opacity: { duration: 0.4, delay },
    },
  });

  // window grid; a few stay flickering forever so the city feels inhabited
  function windowGrid(
    x0: number,
    y0: number,
    cols: number,
    rows: number,
    baseDelay: number,
    w = 9,
    h = 7,
    gx = 16,
    gy = 15
  ) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const lit = idx % 4 === 0;
        const flicker = idx % 7 === 0;
        cells.push(
          <motion.rect
            key={`${x0}-${idx}`}
            x={x0 + c * gx}
            y={y0 + r * gy}
            width={w}
            height={h}
            rx={1}
            fill={lit ? "#fbbf24" : "#93c5fd"}
            initial={{ opacity: 0 }}
            animate={
              flicker
                ? { opacity: [0, lit ? 0.9 : 0.4, 0.15, lit ? 0.9 : 0.4] }
                : { opacity: lit ? 0.85 : 0.35 }
            }
            transition={
              flicker
                ? {
                    duration: 5 + (idx % 3),
                    times: [0, 0.2, 0.6, 1],
                    repeat: Infinity,
                    delay: baseDelay + idx * 0.05,
                  }
                : { duration: 0.5, delay: baseDelay + idx * 0.05 }
            }
          />
        );
      }
    }
    return cells;
  }

  return (
    <svg
      viewBox="0 0 520 400"
      width="100%"
      style={{ maxWidth: 540, position: "relative", zIndex: 1 }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* drifting clouds */}
      <motion.g
        animate={{ x: [0, 46, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        opacity={0.1}
      >
        <ellipse cx={120} cy={60} rx={46} ry={11} fill="#bfdbfe" />
        <ellipse cx={152} cy={50} rx={30} ry={9} fill="#bfdbfe" />
      </motion.g>
      <motion.g
        animate={{ x: [0, -38, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        opacity={0.08}
      >
        <ellipse cx={400} cy={42} rx={52} ry={12} fill="#bfdbfe" />
        <ellipse cx={362} cy={33} rx={28} ry={8} fill="#bfdbfe" />
      </motion.g>

      {/* ground line */}
      <motion.path d="M16 348 H504" stroke={stroke} strokeWidth={2} {...draw(0.1, 1.2)} />
      <motion.path
        d="M30 356 l10 -8 M62 356 l10 -8 M94 356 l10 -8 M126 356 l10 -8 M158 356 l10 -8 M190 356 l10 -8 M222 356 l10 -8 M254 356 l10 -8 M286 356 l10 -8 M318 356 l10 -8 M350 356 l10 -8 M382 356 l10 -8 M414 356 l10 -8 M446 356 l10 -8 M478 356 l10 -8"
        stroke={faint}
        strokeWidth={1}
        opacity={0.5}
        {...draw(0.4, 1.6)}
      />

      {/* left building */}
      <motion.path d="M52 348 V196 H164 V348" stroke={stroke} strokeWidth={2} {...draw(0.5)} />
      <motion.path d="M52 218 H164" stroke={faint} strokeWidth={1} {...draw(0.9, 0.8)} />
      {windowGrid(70, 232, 5, 7, 1.2, 9, 7, 17, 15)}

      {/* main tower */}
      <motion.path
        d="M204 348 V96 H316 V348"
        stroke={stroke}
        strokeWidth={2.5}
        {...draw(0.7, 1.7)}
      />
      {/* parapet + setback crown */}
      <motion.path d="M198 96 H322" stroke={stroke} strokeWidth={2.5} {...draw(1.2, 0.6)} />
      <motion.path d="M232 96 V76 H288 V96" stroke={stroke} strokeWidth={2} {...draw(1.4, 0.6)} />
      {/* antenna + beacon */}
      <motion.path d="M260 76 V46" stroke={stroke} strokeWidth={1.6} {...draw(1.7, 0.4)} />
      <motion.circle
        cx={260}
        cy={42}
        r={3.6}
        fill="#f87171"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.15, 1, 0.15] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 2 }}
      />
      <motion.circle
        cx={260}
        cy={42}
        r={3.6}
        stroke="#f87171"
        initial={{ opacity: 0, scale: 1 }}
        animate={{ opacity: [0.5, 0], scale: [1, 2.6] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 2 }}
        style={{ transformOrigin: "260px 42px" }}
      />
      {/* entrance */}
      <motion.path d="M248 348 V322 H272 V348" stroke={stroke} strokeWidth={1.8} {...draw(1.6, 0.5)} />
      <motion.path d="M260 322 V348" stroke={faint} strokeWidth={1} {...draw(1.8, 0.4)} />
      <motion.path d="M238 316 H282" stroke={stroke} strokeWidth={1.6} {...draw(1.9, 0.4)} />
      {windowGrid(222, 116, 5, 12, 1.5, 9, 7, 17, 16)}

      {/* right building — stepped massing */}
      <motion.path
        d="M356 348 V172 H420 V216 H452 V348"
        stroke={stroke}
        strokeWidth={2}
        {...draw(0.9, 1.5)}
      />
      {windowGrid(370, 190, 3, 9, 1.7, 9, 7, 17, 16)}
      {windowGrid(426, 232, 1, 6, 2.1, 9, 7, 17, 17)}

      {/* tower crane, gently slewing */}
      <motion.g
        style={{ transformOrigin: "480px 120px" }}
        animate={{ rotate: [0, -2.2, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2.4 }}
      >
        {/* jib + counter-jib */}
        <motion.path d="M390 120 H504" stroke={stroke} strokeWidth={1.8} {...draw(1.9, 0.7)} />
        <motion.path
          d="M480 104 L440 120 M480 104 L504 120 M480 104 L390 120"
          stroke={faint}
          strokeWidth={1}
          {...draw(2.1, 0.7)}
        />
        {/* counterweight */}
        <motion.rect
          x={494}
          y={120}
          width={10}
          height={12}
          stroke={stroke}
          strokeWidth={1.4}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 2.4 }}
        />
        {/* trolley cable + hook, bobbing */}
        <motion.g
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2.8 }}
        >
          <motion.path d="M414 120 V188" stroke={faint} strokeWidth={1} {...draw(2.3, 0.5)} />
          <motion.path
            d="M414 188 l-6 8 h12 z"
            stroke={stroke}
            strokeWidth={1.3}
            {...draw(2.5, 0.3)}
          />
        </motion.g>
      </motion.g>
      {/* crane mast */}
      <motion.path d="M474 348 V104 M486 348 V104" stroke={stroke} strokeWidth={1.6} {...draw(1.5, 1)} />
      <motion.path
        d="M474 332 l12 -12 M474 308 l12 -12 M474 284 l12 -12 M474 260 l12 -12 M474 236 l12 -12 M474 212 l12 -12 M474 188 l12 -12 M474 164 l12 -12 M474 140 l12 -12"
        stroke={faint}
        strokeWidth={1}
        {...draw(1.8, 1)}
      />

      {/* dimension line above tower */}
      <motion.path d="M204 70 H316" stroke={faint} strokeWidth={1} {...draw(2.2, 0.6)} />
      <motion.path d="M204 64 V76 M316 64 V76" stroke={faint} strokeWidth={1} {...draw(2.3, 0.4)} />

      {/* compass rose */}
      <motion.g
        style={{ transformOrigin: "64px 92px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <circle cx={64} cy={92} r={22} stroke={faint} strokeWidth={1} opacity={0.6} />
        <path d="M64 72 L70 92 L64 112 L58 92 Z" fill="#93c5fd" opacity={0.9} />
        <path d="M44 92 H84 M64 72 V112" stroke={faint} strokeWidth={0.8} opacity={0.5} />
      </motion.g>
    </svg>
  );
}
