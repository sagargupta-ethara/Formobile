"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, ArrowRight, Check } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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
        router.replace("/dashboard");
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  function quickFill(addr: string) {
    setEmail(addr);
    setPassword("password123");
  }

  return (
    <>
    <div className="login-split">
      {/* -------- Left: animated blueprint -------- */}
      <div
        className="login-art"
        style={{
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "#e2e8f0",
          background: "linear-gradient(155deg, #0b1220 0%, #111827 45%, #0a0f1c 100%)",
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
            <div style={{ fontWeight: 700, color: "#fff", fontSize: "1.02rem" }}>
              Blueprint Flow
            </div>
            <div style={{ fontSize: "0.66rem", color: "#7c8aa3", letterSpacing: "0.06em" }}>
              DESIGN · SITE · EXECUTION
            </div>
          </div>
        </motion.div>

        {/* the animated drawing */}
        <div
          style={{
            position: "relative",
            flex: 1,
            display: "grid",
            placeItems: "center",
            padding: "0 2rem 2rem",
          }}
        >
          <BlueprintArt />
        </div>
      </div>

      {/* -------- Right: form -------- */}
      <div
        style={{
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "var(--color-canvas)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          className="card"
          style={{ width: "100%", maxWidth: 400, padding: "2.2rem" }}
        >
          <h2 style={{ fontSize: "1.4rem", fontWeight: 750, letterSpacing: "-0.02em" }}>
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
                autoFocus
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

          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid #eef2f7" }}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "#94a3b8",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              DEMO ACCOUNTS · tap to fill
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { label: "Admin", email: "admin@blueprint.test" },
                { label: "Designer", email: "designer@blueprint.test" },
                { label: "On-Site", email: "onsite@blueprint.test" },
              ].map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => quickFill(a.email)}
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
 *  Self-drawing architectural blueprint (floor plan + compass)   *
 * -------------------------------------------------------------- */
function BlueprintArt() {
  const stroke = "#7cb0ff";
  const faint = "#3b6fd4";

  // each line draws forward then erases, looping — like a plan being drafted
  const draw = (i: number) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 0.95 },
    transition: {
      pathLength: {
        duration: 2.4,
        ease: EASE,
        repeat: Infinity,
        repeatType: "reverse" as const,
        repeatDelay: 1.2,
        delay: i * 0.25,
      },
      opacity: { duration: 0.6, delay: i * 0.25 },
    },
  });

  return (
    <svg
      viewBox="0 0 420 420"
      width="100%"
      style={{ maxWidth: 460, position: "relative", zIndex: 1 }}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* dimension line (top) */}
      <motion.path d="M60 46 H360" stroke={faint} strokeWidth={1} {...draw(0)} />
      <motion.path d="M60 40 V52 M360 40 V52 M210 41 V51" stroke={faint} strokeWidth={1} {...draw(0)} />

      {/* outer walls */}
      <motion.path
        d="M60 80 H360 V340 H60 Z"
        stroke={stroke}
        strokeWidth={2.5}
        {...draw(1)}
      />

      {/* interior partitions */}
      <motion.path d="M210 80 V210" stroke={stroke} strokeWidth={2} {...draw(2)} />
      <motion.path d="M210 210 H360" stroke={stroke} strokeWidth={2} {...draw(3)} />
      <motion.path d="M60 250 H150 V340" stroke={stroke} strokeWidth={2} {...draw(4)} />

      {/* door swing arc */}
      <motion.path d="M210 150 A40 40 0 0 1 250 110" stroke={stroke} strokeWidth={1.5} {...draw(5)} />
      <motion.path d="M150 295 A35 35 0 0 0 115 260" stroke={stroke} strokeWidth={1.5} {...draw(5)} />

      {/* round column */}
      <motion.circle
        cx={285}
        cy={285}
        r={26}
        stroke={stroke}
        strokeWidth={1.8}
        {...draw(6)}
      />
      <motion.path d="M285 259 V311 M259 285 H311" stroke={faint} strokeWidth={1} {...draw(6)} />

      {/* stairs */}
      <motion.path
        d="M110 110 H170 M110 124 H170 M110 138 H170 M110 152 H170 M110 110 V152"
        stroke={stroke}
        strokeWidth={1.4}
        {...draw(7)}
      />

      {/* corner nodes — gentle pulse */}
      {[
        [60, 80], [360, 80], [360, 340], [60, 340],
      ].map(([cx, cy], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={3.5}
          fill="#93c5fd"
          initial={{ opacity: 0.3, scale: 0.8 }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4 }}
        />
      ))}

      {/* slowly rotating compass rose */}
      <motion.g
        style={{ transformOrigin: "350px 110px" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      >
        <circle cx={350} cy={110} r={22} stroke={faint} strokeWidth={1} opacity={0.6} />
        <path d="M350 90 L356 110 L350 130 L344 110 Z" fill="#93c5fd" opacity={0.9} />
        <path d="M330 110 H370 M350 90 V130" stroke={faint} strokeWidth={0.8} opacity={0.5} />
      </motion.g>
    </svg>
  );
}
