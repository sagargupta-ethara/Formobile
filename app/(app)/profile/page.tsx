"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Mail, Shield, Briefcase } from "lucide-react";
import { api, PageHeader, Avatar, Badge, ErrorText, Skeleton } from "@/components/ui";
import { EASE } from "@/components/motion";
import { fmtDate } from "@/lib/format";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  specialization: { id: string; name: string } | null;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  DESIGNER: "Designer",
  ONSITE: "On-Site Reviewer",
};

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    const d = await api<{ user: Profile }>("/api/profile");
    setP(d.user);
  }
  useEffect(() => {
    load();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await load();
      flash("Profile photo updated");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!p)
    return (
      <>
        <PageHeader title="Profile" />
        <Skeleton rows={3} />
      </>
    );

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account and personal details" />

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "fixed",
            top: 70,
            right: 28,
            zIndex: 80,
            background: "#0f172a",
            color: "#fff",
            padding: "0.65rem 1rem",
            borderRadius: 10,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <Check size={16} color="#4ade80" /> {toast}
        </motion.div>
      )}

      <div className="r-side">
        {/* avatar card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="card"
          style={{
            padding: "1.8rem 1.4rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            height: "fit-content",
          }}
        >
          <div style={{ position: "relative" }}>
            <motion.div whileHover={{ scale: 1.03 }} transition={{ duration: 0.2 }}>
              <Avatar name={p.name} src={p.avatarUrl} size={120} />
            </motion.div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Change photo"
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 38,
                height: 38,
                borderRadius: 999,
                border: "3px solid #fff",
                background: "#1e293b",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                boxShadow: "var(--shadow-md)",
              }}
            >
              {uploading ? <span className="spinner" /> : <Camera size={16} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onPick}
              style={{ display: "none" }}
            />
          </div>

          <div style={{ marginTop: 16, fontWeight: 700, fontSize: "1.15rem" }}>
            {p.name}
          </div>
          <div style={{ marginTop: 6 }}>
            <Badge bg="#eef2ff" fg="#4338ca" dot>
              {ROLE_LABEL[p.role] ?? p.role}
            </Badge>
          </div>
          <p style={{ marginTop: 14, fontSize: "0.78rem", color: "#94a3b8" }}>
            Click the camera to upload a photo
            <br />
            PNG · JPG · WEBP · GIF, up to 5 MB
          </p>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid #f1f5f9",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              textAlign: "left",
            }}
          >
            <Row icon={<Mail size={15} />} label={p.email} />
            <Row icon={<Shield size={15} />} label={ROLE_LABEL[p.role] ?? p.role} />
            {p.specialization && (
              <Row icon={<Briefcase size={15} />} label={p.specialization.name} />
            )}
          </div>
          <div style={{ marginTop: 12, fontSize: "0.74rem", color: "#cbd5e1" }}>
            Member since {fmtDate(p.createdAt)}
          </div>
        </motion.div>

        {/* edit forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DetailsForm profile={p} onSaved={(m) => { load(); flash(m); }} />
          <PasswordForm onSaved={(m) => flash(m)} />
        </div>
      </div>
    </>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: "0.83rem", color: "#475569" }}>
      <span style={{ color: "#94a3b8" }}>{icon}</span>
      {label}
    </div>
  );
}

function DetailsForm({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (msg: string) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      onSaved("Profile saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
      onSubmit={submit}
      className="card"
      style={{ padding: "1.4rem" }}
    >
      <div style={{ fontWeight: 700, marginBottom: 14 }}>Personal Details</div>
      <ErrorText>{error}</ErrorText>
      <div className="form-grid">
        <div>
          <label className="label">Full Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={profile.email} disabled />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn btn-primary" disabled={saving}>
          {saving && <span className="spinner" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </motion.form>
  );
}

function PasswordForm({ onSaved }: { onSaved: (msg: string) => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrent("");
      setNew("");
      onSaved("Password changed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.16 }}
      onSubmit={submit}
      className="card"
      style={{ padding: "1.4rem" }}
    >
      <div style={{ fontWeight: 700, marginBottom: 14 }}>Change Password</div>
      <ErrorText>{error}</ErrorText>
      <div className="form-grid">
        <div>
          <label className="label">Current Password</label>
          <input
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            placeholder="min 6 characters"
            required
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn btn-primary" disabled={saving}>
          {saving && <span className="spinner" />}
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </motion.form>
  );
}
