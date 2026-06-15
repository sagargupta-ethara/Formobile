// Import the firm's real staff and remove the seeded demo data.
// Run: npx tsx prisma/import-team.ts
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// DEPARTMENT/TEAM → platform mapping:
//   Admin                       → ADMIN
//   Interior Design             → DESIGNER · Interior
//   Architecture / Structure    → DESIGNER · Civil
//   Site Head (off site)        → ONSITE   · (general)
//   Site Supervisor (off site)  → ONSITE   · Civil
//   carpentry (off site)        → ONSITE   · Furniture
//   Plumbing / Electrical / HVAC (MEP) → ONSITE · matching team
const TEAM: { name: string; email: string; role: Role; spec?: string; dept: string }[] = [
  { name: "Manish Uppal", email: "manish.uppal@blueprintflow.in", role: "ADMIN", dept: "Admin" },
  { name: "Reediima Uppal", email: "reediima.uppal@blueprintflow.in", role: "ADMIN", dept: "Admin" },
  { name: "Kanhav Uppal", email: "kanhav.uppal@blueprintflow.in", role: "ADMIN", dept: "Admin" },

  { name: "Amarpreet Padam", email: "amarpreet.padam@blueprintflow.in", role: "DESIGNER", spec: "Interior", dept: "Interior Design" },
  { name: "Sanjana Dawar", email: "sanjana.dawar@blueprintflow.in", role: "DESIGNER", spec: "Interior", dept: "Interior Design" },
  { name: "Nidhi Kamboj", email: "nidhi.kamboj@blueprintflow.in", role: "DESIGNER", spec: "Interior", dept: "Interior Design" },
  { name: "Astha", email: "astha@blueprintflow.in", role: "DESIGNER", spec: "Interior", dept: "Interior Design" },

  { name: "Pankaj", email: "pankaj@blueprintflow.in", role: "DESIGNER", spec: "Civil", dept: "Architecture · Structure" },
  { name: "Kiranpreet", email: "kiranpreet@blueprintflow.in", role: "DESIGNER", spec: "Civil", dept: "Architecture · Structure" },
  { name: "Rajesh", email: "rajesh@blueprintflow.in", role: "DESIGNER", spec: "Civil", dept: "Architecture · Structure" },

  { name: "Sewa Ram Sharma", email: "sewaram.sharma@blueprintflow.in", role: "ONSITE", dept: "Site Head" },
  { name: "Pradeep Rawat", email: "pradeep.rawat@blueprintflow.in", role: "ONSITE", dept: "Site Head" },
  { name: "Virender", email: "virender@blueprintflow.in", role: "ONSITE", dept: "Site Head" },

  { name: "Praveen", email: "praveen@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },
  { name: "Zakir", email: "zakir@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },
  { name: "Sudama", email: "sudama@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },
  { name: "Vijay", email: "vijay@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },
  { name: "Nand Kishore", email: "nand.kishore@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },
  { name: "Gaurav", email: "gaurav@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },
  { name: "Rajesh", email: "rajesh.site@blueprintflow.in", role: "ONSITE", dept: "Site Supervisor" },

  { name: "Kailash", email: "kailash@blueprintflow.in", role: "ONSITE", dept: "Carpentry" },

  { name: "Dighamber", email: "dighamber@blueprintflow.in", role: "ONSITE", spec: "Plumbing", dept: "MEP · Plumbing" },
  { name: "Mahesh", email: "mahesh@blueprintflow.in", role: "ONSITE", spec: "Electrical", dept: "MEP · Electrical" },
  { name: "Sandeep", email: "sandeep@blueprintflow.in", role: "ONSITE", spec: "Electrical", dept: "MEP · Electrical" },
  { name: "Salman", email: "salman@blueprintflow.in", role: "ONSITE", spec: "HVAC", dept: "MEP · HVAC" },
];

const DUMMY_EMAILS = [
  "admin@blueprint.test",
  "designer@blueprint.test",
  "priya@blueprint.test",
  "onsite@blueprint.test",
  "plumber@blueprint.test",
];

async function main() {
  const pw = await bcrypt.hash("password123", 10);

  const specNames = [...new Set(TEAM.map((t) => t.spec).filter(Boolean))] as string[];
  const specs: Record<string, string> = {};
  for (const name of specNames) {
    const s = await prisma.specialization.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    specs[name] = s.id;
  }

  let created = 0;
  for (const t of TEAM) {
    await prisma.user.upsert({
      where: { email: t.email },
      update: {
        name: t.name,
        role: t.role,
        specializationId: t.spec ? specs[t.spec] : null,
      },
      create: {
        name: t.name,
        email: t.email,
        role: t.role,
        specializationId: t.spec ? specs[t.spec] : null,
        passwordHash: pw,
      },
    });
    created++;
  }
  console.log(`Imported/updated ${created} team members.`);

  // remove demo users
  const del = await prisma.user.deleteMany({ where: { email: { in: DUMMY_EMAILS } } });
  console.log(`Removed ${del.count} demo users.`);

  // remove the seeded demo project (its floors/tasks/files cascade)
  const demo = await prisma.project.findUnique({ where: { code: "ABC-TOWER" } });
  if (demo) {
    await prisma.project.delete({ where: { id: demo.id } });
    console.log("Removed demo project ABC-TOWER.");
  }

  console.log("\nLogins (initial password: password123 — change in Profile):");
  for (const t of TEAM) console.log(`  ${t.role.padEnd(8)} ${t.email.padEnd(38)} ${t.name} — ${t.dept}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
