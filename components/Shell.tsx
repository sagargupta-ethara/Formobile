"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Users,
  Settings,
  LogOut,
  Compass,
  UserCircle,
  Menu,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui";

type Role = "ADMIN" | "DESIGNER" | "ONSITE";

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  DESIGNER: "Designer",
  ONSITE: "On-Site Reviewer",
};

type NavItem = { href: string; label: string; icon: React.ReactNode };

function navFor(role: Role): NavItem[] {
  const I = { width: 18, height: 18 } as const;
  const profile = { href: "/profile", label: "Profile", icon: <UserCircle {...I} /> };
  if (role === "ADMIN")
    return [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard {...I} /> },
      { href: "/projects", label: "Projects", icon: <FolderKanban {...I} /> },
      { href: "/tasks", label: "Design Tasks", icon: <ListChecks {...I} /> },
      { href: "/users", label: "Team", icon: <Users {...I} /> },
      { href: "/settings", label: "Settings", icon: <Settings {...I} /> },
      profile,
    ];
  if (role === "DESIGNER")
    return [
      { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard {...I} /> },
      { href: "/tasks", label: "My Tasks", icon: <ListChecks {...I} /> },
      profile,
    ];
  return [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard {...I} /> },
    { href: "/tasks", label: "Reviews", icon: <ListChecks {...I} /> },
    profile,
  ];
}

export default function Shell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user.name);
  const nav = navFor(user.role);
  const current =
    nav.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"))?.label ?? "";

  useEffect(() => {
    setDrawer(false); // close drawer on navigation
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setAvatarUrl(d.user.avatarUrl ?? null);
          setDisplayName(d.user.name ?? user.name);
        }
      })
      .catch(() => {});
  }, [pathname, user.name]);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="app-shell">
      {drawer && <div className="app-overlay" onClick={() => setDrawer(false)} />}

      {/* ---------------- Sidebar ---------------- */}
      <aside
        className={`app-sidebar${drawer ? " open" : ""}`}
        style={{
          background: "linear-gradient(180deg, #111827 0%, #0b1220 60%, #0a0f1c 100%)",
          color: "#e2e8f0",
          padding: "1.1rem 0.85rem",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.2rem 0.4rem 1.2rem",
          }}
        >
          <Link
            href="/dashboard"
            style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "inherit" }}
          >
            <motion.div
              initial={{ rotate: -8, scale: 0.9, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "linear-gradient(135deg, #3b82f6, #1e3a8a)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 6px 18px -4px rgba(37,99,235,0.6)",
              }}
            >
              <Compass width={19} height={19} color="#fff" />
            </motion.div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 700, color: "#fff", fontSize: "0.98rem" }}>
                Blueprint Flow
              </div>
              <div style={{ fontSize: "0.66rem", color: "#7c8aa3", letterSpacing: "0.04em" }}>
                DESIGN · SITE · EXECUTION
              </div>
            </div>
          </Link>
          <button
            className="mobile-only"
            onClick={() => setDrawer(false)}
            style={{
              background: "none",
              border: "none",
              color: "#9fb0c9",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "0.62rem 0.72rem",
                  borderRadius: 10,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: active ? "#fff" : "#9fb0c9",
                  textDecoration: "none",
                }}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 10,
                      background: "linear-gradient(90deg, rgba(59,130,246,0.22), rgba(59,130,246,0.08))",
                      border: "1px solid rgba(59,130,246,0.35)",
                      zIndex: 0,
                    }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1, display: "inline-flex" }}>
                  {item.icon}
                </span>
                <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0.6rem 0.65rem",
              borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              textDecoration: "none",
            }}
          >
            <Avatar name={displayName} src={avatarUrl} size={36} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {displayName}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#7c8aa3" }}>
                {ROLE_LABEL[user.role]}
              </div>
            </div>
          </Link>
          <button
            onClick={logout}
            disabled={busy}
            className="btn"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.06)",
              color: "#cbd5e1",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <LogOut width={16} height={16} />
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="app-main blueprint-bg">
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            backdropFilter: "saturate(180%) blur(12px)",
            background: "rgba(238,242,247,0.72)",
            borderBottom: "1px solid var(--color-line)",
          }}
        >
          <div className="app-topbar-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <button
                className="menu-btn"
                onClick={() => setDrawer(true)}
                style={{
                  background: "#fff",
                  border: "1px solid var(--color-line)",
                  borderRadius: 9,
                  padding: 7,
                  cursor: "pointer",
                  color: "#334155",
                  alignItems: "center",
                }}
              >
                <Menu size={18} />
              </button>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 500,
                  minWidth: 0,
                }}
              >
                <span className="hide-xs" style={{ color: "#94a3b8" }}>
                  Blueprint Flow
                </span>
                <span className="hide-xs" style={{ color: "#cbd5e1" }}>
                  /
                </span>
                <span style={{ color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {current}
                </span>
              </div>
            </div>
            <div
              className="mono hide-xs"
              style={{
                fontSize: "0.72rem",
                color: "#64748b",
                padding: "0.3rem 0.65rem",
                borderRadius: 999,
                background: "#fff",
                border: "1px solid var(--color-line)",
                boxShadow: "var(--shadow-sm)",
                whiteSpace: "nowrap",
              }}
            >
              {today}
            </div>
          </div>
        </div>

        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
