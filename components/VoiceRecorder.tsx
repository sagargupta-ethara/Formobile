"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Square, Trash2 } from "lucide-react";

const MAX_SECONDS = 5 * 60; // PRD: 5 minute cap

function pickMime(): { mime: string; ext: string } {
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "webm" };
  const candidates: [string, string][] = [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/ogg;codecs=opus", "ogg"],
  ];
  for (const [mime, ext] of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return { mime: "", ext: "webm" };
}

export function recorderSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

/**
 * Built-in voice memo recorder (PRD Module 8). Records via MediaRecorder,
 * shows elapsed time + level bars, caps at 5 minutes, and offers playback
 * before submitting. Calls onChange with the recorded file (or null).
 */
export default function VoiceRecorder({
  onChange,
  onUnavailable,
}: {
  onChange: (file: File | null) => void;
  /** Called when recording turns out to be impossible (no mic / permission denied). */
  onUnavailable?: () => void;
}) {
  const [state, setState] = useState<"idle" | "recording" | "done" | "denied">("idle");
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const extRef = useRef("webm");

  useEffect(() => {
    return () => {
      stopTimer();
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, ext } = pickMime();
      extRef.current = ext;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], `voice-note.${extRef.current}`, {
          type: blob.type,
        });
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        setState("done");
        onChange(file);
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setState("denied");
      onChange(null);
      onUnavailable?.();
    }
  }

  function stop() {
    stopTimer();
    if (recRef.current?.state !== "inactive") recRef.current?.stop();
  }

  function discard() {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setSeconds(0);
    setState("idle");
    onChange(null);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  if (state === "denied")
    return (
      <div
        style={{
          fontSize: "0.8rem",
          color: "#b45309",
          background: "#fef3c7",
          border: "1px solid #fde68a",
          borderRadius: 9,
          padding: "0.55rem 0.75rem",
        }}
      >
        Microphone unavailable or permission denied — the written reason will be
        sent without a voice note.{" "}
        <button
          type="button"
          onClick={() => setState("idle")}
          style={{
            border: "none",
            background: "none",
            color: "#92400e",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Try again
        </button>
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        border: "1px solid var(--color-line)",
        borderRadius: 10,
        padding: "0.6rem 0.75rem",
        background: "#f8fafc",
      }}
    >
      {state === "idle" && (
        <>
          <button type="button" className="btn btn-ghost" onClick={start}>
            <Mic size={15} color="#dc2626" /> Record voice memo
          </button>
          <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>max 5 minutes</span>
        </>
      )}

      {state === "recording" && (
        <>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#dc2626",
              animation: "blink 1.2s ease infinite",
            }}
          />
          {/* level bars */}
          <span style={{ display: "flex", gap: 2.5, alignItems: "center", height: 20 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <motion.span
                key={i}
                animate={{ height: [4, 6 + ((i * 7) % 14), 4] }}
                transition={{ duration: 0.7 + (i % 4) * 0.13, repeat: Infinity, ease: "easeInOut" }}
                style={{ width: 3, borderRadius: 999, background: "#dc2626", opacity: 0.8 }}
              />
            ))}
          </span>
          <span className="mono" style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a" }}>
            {mm}:{ss}
          </span>
          <button type="button" className="btn btn-danger" onClick={stop} style={{ padding: "0.45rem 0.8rem" }}>
            <Square size={13} /> Stop
          </button>
        </>
      )}

      {state === "done" && url && (
        <>
          <audio controls src={url} style={{ height: 36, maxWidth: 240 }} />
          <span className="mono" style={{ fontSize: "0.78rem", color: "#64748b" }}>
            {mm}:{ss}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={discard}
            style={{ padding: "0.45rem 0.7rem" }}
          >
            <Trash2 size={14} /> Re-record
          </button>
        </>
      )}
    </div>
  );
}
