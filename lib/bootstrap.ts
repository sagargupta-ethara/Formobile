import "server-only";
import bcrypt from "bcryptjs";
import type { FloorType, Role } from "@prisma/client";
import { prisma } from "./db";
import { drawingRegister, guessDiscipline, guessSpecialization } from "./drawingTypes";
import { copyTemplateRegister } from "./projectRegister";

// The firm's real team — kept in sync with prisma/import-team.ts. Seeded on an
// empty database so a fresh deploy has working logins (shared password below).
const TEAM: { name: string; email: string; role: Role; spec?: string }[] = [
  { name: "Manish Uppal", email: "manish.uppal@blueprintflow.in", role: "ADMIN" },
  { name: "Reediima Uppal", email: "reediima.uppal@blueprintflow.in", role: "ADMIN" },
  { name: "Kanhav Uppal", email: "kanhav.uppal@blueprintflow.in", role: "ADMIN" },
  { name: "Amarpreet Padam", email: "amarpreet.padam@blueprintflow.in", role: "DESIGNER", spec: "Interior" },
  { name: "Sanjana Dawar", email: "sanjana.dawar@blueprintflow.in", role: "DESIGNER", spec: "Interior" },
  { name: "Nidhi Kamboj", email: "nidhi.kamboj@blueprintflow.in", role: "DESIGNER", spec: "Interior" },
  { name: "Astha", email: "astha@blueprintflow.in", role: "DESIGNER", spec: "Interior" },
  { name: "Pankaj", email: "pankaj@blueprintflow.in", role: "DESIGNER", spec: "Civil" },
  { name: "Kiranpreet", email: "kiranpreet@blueprintflow.in", role: "DESIGNER", spec: "Civil" },
  { name: "Rajesh", email: "rajesh@blueprintflow.in", role: "DESIGNER", spec: "Civil" },
  { name: "Sewa Ram Sharma", email: "sewaram.sharma@blueprintflow.in", role: "ONSITE" },
  { name: "Pradeep Rawat", email: "pradeep.rawat@blueprintflow.in", role: "ONSITE" },
  { name: "Virender", email: "virender@blueprintflow.in", role: "ONSITE" },
  { name: "Praveen", email: "praveen@blueprintflow.in", role: "ONSITE" },
  { name: "Zakir", email: "zakir@blueprintflow.in", role: "ONSITE" },
  { name: "Sudama", email: "sudama@blueprintflow.in", role: "ONSITE" },
  { name: "Vijay", email: "vijay@blueprintflow.in", role: "ONSITE" },
  { name: "Nand Kishore", email: "nand.kishore@blueprintflow.in", role: "ONSITE" },
  { name: "Gaurav", email: "gaurav@blueprintflow.in", role: "ONSITE" },
  { name: "Rajesh", email: "rajesh.site@blueprintflow.in", role: "ONSITE" },
  { name: "Kailash", email: "kailash@blueprintflow.in", role: "ONSITE" },
  { name: "Dighamber", email: "dighamber@blueprintflow.in", role: "ONSITE", spec: "Plumbing" },
  { name: "Mahesh", email: "mahesh@blueprintflow.in", role: "ONSITE", spec: "Electrical" },
  { name: "Sandeep", email: "sandeep@blueprintflow.in", role: "ONSITE", spec: "Electrical" },
  { name: "Salman", email: "salman@blueprintflow.in", role: "ONSITE", spec: "HVAC" },
];

const SPEC_NAMES = [
  "Electrical", "Plumbing", "Furniture", "HVAC",
  "Civil", "Landscape", "Interior", "Lighting",
];

let ran = false;

/**
 * Idempotently ensure the database has the data the app needs. Runs in-process
 * at server startup (instrumentation), so it works regardless of how Next.js was
 * launched. Each block is independently gated so a partially-seeded DB (e.g.
 * users present but the drawing register missing) self-heals on the next boot.
 */
export async function ensureSeeded(): Promise<void> {
  if (ran) return;
  ran = true;
  try {
    // ---- Specializations (idempotent; needed by the register + users) ----
    const specs: Record<string, string> = {};
    for (const name of SPEC_NAMES) {
      const s = await prisma.specialization.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      specs[name] = s.id;
    }

    // ---- Normalize legacy master-register rows ----
    // On MongoDB, rows created without passing projectId have the field MISSING
    // (isSet:false), which Prisma's `{ projectId: null }` filter does NOT match —
    // so the master register looked empty even when rows existed. Convert any
    // such rows to an explicit BSON null so every `{ projectId: null }` query
    // (here, copyTemplateRegister, /api/categories) matches them. Idempotent.
    try {
      const res = (await prisma.$runCommandRaw({
        update: "DesignCategory",
        updates: [
          { q: { projectId: { $exists: false } }, u: { $set: { projectId: null } }, multi: true },
        ],
      })) as { nModified?: number };
      if (res?.nModified) console.log(`[bootstrap] Normalized ${res.nModified} legacy master-register rows.`);
    } catch (err) {
      console.error("[bootstrap] register normalization skipped:", err instanceof Error ? err.message : err);
    }

    // ---- Master drawing register (template, projectId = null) ----
    // Seed only when it's empty — decoupled from the user check so a DB that
    // already has users but no register (e.g. an earlier partial seed) is fixed.
    let masterCount = await prisma.designCategory.count({ where: { projectId: null } });
    if (masterCount === 0) {
      console.log("[bootstrap] Seeding master drawing register…");
      for (const d of drawingRegister()) {
        const specName = guessSpecialization(d.name);
        try {
          await prisma.designCategory.create({
            data: {
              name: d.name,
              projectId: null,
              appliesTo: d.appliesTo as unknown as FloorType[],
              specializationId: specName ? specs[specName] ?? null : null,
              discipline: guessDiscipline(d.name),
            },
          });
        } catch (err) {
          // ignore unique-constraint collisions (concurrent replica / re-run)
          if (!(err instanceof Error && err.message.includes("Unique constraint"))) throw err;
        }
      }
      masterCount = await prisma.designCategory.count({ where: { projectId: null } });
      console.log(`[bootstrap] Master register seeded (${masterCount} types).`);
    }

    // Backfill any project that has no drawing register yet (independent of the
    // master-register gate, so existing empty projects self-heal).
    if (masterCount > 0) {
      const projects = await prisma.project.findMany({ select: { id: true } });
      for (const p of projects) {
        const have = await prisma.designCategory.count({ where: { projectId: p.id } });
        if (have === 0) {
          try {
            const n = await copyTemplateRegister(p.id);
            console.log(`[bootstrap] Backfilled ${n} drawings into project ${p.id}.`);
          } catch (err) {
            console.error("[bootstrap] backfill skipped for", p.id, err instanceof Error ? err.message : err);
          }
        }
      }
    }

    // ---- Team users (shared initial password) — only when there are none ----
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("[bootstrap] Seeding team users…");
      const pw = await bcrypt.hash("password123", 10);
      for (const t of TEAM) {
        await prisma.user.upsert({
          where: { email: t.email },
          update: {},
          create: {
            name: t.name,
            email: t.email,
            role: t.role,
            specializationId: t.spec ? specs[t.spec] ?? null : null,
            passwordHash: pw,
          },
        });
      }
      console.log(`[bootstrap] Seeded ${TEAM.length} users.`);
    }
  } catch (e) {
    console.error("[bootstrap] Seed failed (server will continue):", e instanceof Error ? e.message : e);
  }
}
