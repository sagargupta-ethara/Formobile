import "server-only";
import bcrypt from "bcryptjs";
import type { FloorType, Role } from "@prisma/client";
import { prisma } from "./db";
import { drawingRegister, guessDiscipline, guessSpecialization } from "./drawingTypes";

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
 * Seed the master drawing register + the firm's team ONCE, only when the
 * database has no users. Runs in-process at server startup (instrumentation),
 * so it works regardless of how Next.js was launched in production.
 */
export async function ensureSeeded(): Promise<void> {
  if (ran) return;
  ran = true;
  try {
    const count = await prisma.user.count();
    if (count > 0) return;
    console.log("[bootstrap] Empty database — seeding specializations, master register and team…");

    // ---- Specializations ----
    const specs: Record<string, string> = {};
    for (const name of SPEC_NAMES) {
      const s = await prisma.specialization.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      specs[name] = s.id;
    }

    // ---- Master drawing register (template, projectId = null) ----
    for (const d of drawingRegister()) {
      const specName = guessSpecialization(d.name);
      const existing = await prisma.designCategory.findFirst({
        where: { projectId: null, name: d.name },
      });
      const data = {
        appliesTo: d.appliesTo as unknown as FloorType[],
        specializationId: specName ? specs[specName] ?? null : null,
        discipline: guessDiscipline(d.name),
      };
      if (existing) {
        await prisma.designCategory.update({ where: { id: existing.id }, data: { appliesTo: data.appliesTo } });
      } else {
        await prisma.designCategory.create({ data: { name: d.name, ...data } });
      }
    }

    // ---- Team users (shared initial password) ----
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
    console.log(`[bootstrap] Seed complete — ${TEAM.length} users, ${SPEC_NAMES.length} specializations.`);
  } catch (e) {
    console.error("[bootstrap] Seed failed (server will continue):", e instanceof Error ? e.message : e);
  }
}
