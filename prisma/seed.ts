import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.env.STORAGE_DIR ?? "./storage");

// minimal valid PDF body so seeded files actually open in a viewer
const SAMPLE_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
);

async function writeSampleFile(taskId: string, name: string) {
  const dir = path.join(STORAGE, "tasks", taskId);
  await fs.mkdir(dir, { recursive: true });
  const key = `${crypto.randomBytes(8).toString("hex")}-${name}`;
  await fs.writeFile(path.join(dir, key), SAMPLE_PDF);
  return path.relative(STORAGE, path.join(dir, key));
}

async function main() {
  console.log("Seeding Blueprint Flow…");
  const pw = await bcrypt.hash("password123", 10);

  // ---- Specializations ----
  const specNames = [
    "Electrical", "Plumbing", "Furniture", "HVAC",
    "Civil", "Landscape", "Interior", "Lighting",
  ];
  const specs: Record<string, string> = {};
  for (const name of specNames) {
    const s = await prisma.specialization.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    specs[name] = s.id;
  }

  // ---- Design categories ----
  const cats: { name: string; spec?: string }[] = [
    { name: "Electrical Design", spec: "Electrical" },
    { name: "Plumbing Design", spec: "Plumbing" },
    { name: "Furniture Layout", spec: "Furniture" },
    { name: "Seating Layout", spec: "Furniture" },
    { name: "HVAC Design", spec: "HVAC" },
    { name: "Lighting Design", spec: "Lighting" },
    { name: "Interior Design", spec: "Interior" },
    { name: "False Ceiling Design", spec: "Interior" },
    { name: "Landscape Design", spec: "Landscape" },
    { name: "Fire Safety Design", spec: "Civil" },
    { name: "Network Cabling Design", spec: "Electrical" },
  ];
  const catId: Record<string, string> = {};
  for (const c of cats) {
    const created = await prisma.designCategory.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, specializationId: c.spec ? specs[c.spec] : null },
    });
    catId[c.name] = created.id;
  }

  // ---- Users ----
  const admin = await prisma.user.upsert({
    where: { email: "admin@blueprint.test" },
    update: {},
    create: {
      name: "Aarav Mehta",
      email: "admin@blueprint.test",
      phone: "+91 90000 00001",
      role: "ADMIN",
      passwordHash: pw,
    },
  });
  const rahul = await prisma.user.upsert({
    where: { email: "designer@blueprint.test" },
    update: {},
    create: {
      name: "Rahul Sharma",
      email: "designer@blueprint.test",
      phone: "+91 90000 00002",
      role: "DESIGNER",
      specializationId: specs["Electrical"],
      passwordHash: pw,
    },
  });
  const priya = await prisma.user.upsert({
    where: { email: "priya@blueprint.test" },
    update: {},
    create: {
      name: "Priya Nair",
      email: "priya@blueprint.test",
      phone: "+91 90000 00003",
      role: "DESIGNER",
      specializationId: specs["Interior"],
      passwordHash: pw,
    },
  });
  const onsite = await prisma.user.upsert({
    where: { email: "onsite@blueprint.test" },
    update: {},
    create: {
      name: "Vikram Singh",
      email: "onsite@blueprint.test",
      phone: "+91 90000 00004",
      role: "ONSITE",
      specializationId: specs["Electrical"],
      passwordHash: pw,
    },
  });
  await prisma.user.upsert({
    where: { email: "plumber@blueprint.test" },
    update: {},
    create: {
      name: "Suresh Kumar",
      email: "plumber@blueprint.test",
      role: "ONSITE",
      specializationId: specs["Plumbing"],
      passwordHash: pw,
    },
  });

  // ---- Project + floors ----
  // Start clean for demo tasks to keep the seed idempotent-ish
  const existing = await prisma.project.findUnique({
    where: { code: "ABC-TOWER" },
  });
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } });
  }
  const floorNames = ["Basement", "Ground Floor", "First Floor", "Second Floor", "Third Floor"];
  const project = await prisma.project.create({
    data: {
      name: "ABC Corporate Tower",
      code: "ABC-TOWER",
      clientName: "ABC Industries Ltd.",
      location: "Bengaluru, IN",
      startDate: new Date("2026-05-01"),
      expectedCompletion: new Date("2026-12-15"),
      status: "ACTIVE",
      floors: {
        create: floorNames.map((floorName, order) => ({ floorName, order })),
      },
    },
    include: { floors: true },
  });
  const floor = (n: string) => project.floors.find((f) => f.floorName === n)!.id;

  const dueIn = (days: number) =>
    new Date(Date.now() + days * 24 * 3600 * 1000);

  // 1) Assigned, no upload yet
  await prisma.designTask.create({
    data: {
      projectId: project.id,
      floorId: floor("Ground Floor"),
      categoryId: catId["Electrical Design"],
      designerId: rahul.id,
      deadline: dueIn(6),
      priority: "HIGH",
      status: "ASSIGNED",
    },
  });

  // 2) Uploaded V1, pending on-site review (Electrical -> Vikram)
  const t2 = await prisma.designTask.create({
    data: {
      projectId: project.id,
      floorId: floor("First Floor"),
      categoryId: catId["Electrical Design"],
      designerId: rahul.id,
      deadline: dueIn(3),
      priority: "MEDIUM",
      status: "PENDING_REVIEW",
      currentVersion: 1,
      reviewDueAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });
  await prisma.designFile.create({
    data: {
      taskId: t2.id,
      version: 1,
      fileName: "electrical-l1-v1.pdf",
      fileType: "pdf",
      fileSize: SAMPLE_PDF.length,
      storageKey: await writeSampleFile(t2.id, "electrical-l1-v1.pdf"),
      uploadedById: rahul.id,
    },
  });

  // 3) Uploaded V1 then REJECTED — on-site must NOT see the old version now
  const t3 = await prisma.designTask.create({
    data: {
      projectId: project.id,
      floorId: floor("Second Floor"),
      categoryId: catId["Electrical Design"],
      designerId: rahul.id,
      deadline: dueIn(1),
      priority: "URGENT",
      status: "REJECTED",
      currentVersion: 1,
    },
  });
  await prisma.designFile.create({
    data: {
      taskId: t3.id,
      version: 1,
      fileName: "electrical-l2-v1.pdf",
      fileType: "pdf",
      fileSize: SAMPLE_PDF.length,
      storageKey: await writeSampleFile(t3.id, "electrical-l2-v1.pdf"),
      uploadedById: rahul.id,
    },
  });
  await prisma.review.create({
    data: {
      taskId: t3.id,
      reviewerId: onsite.id,
      version: 1,
      decision: "REJECTED",
      comments:
        "Conduit routing clashes with the HVAC duct on the east wall. Please reroute and resubmit.",
    },
  });

  // 4) Approved
  const t4 = await prisma.designTask.create({
    data: {
      projectId: project.id,
      floorId: floor("Third Floor"),
      categoryId: catId["Electrical Design"],
      designerId: priya.id,
      deadline: dueIn(10),
      priority: "LOW",
      status: "APPROVED",
      currentVersion: 1,
    },
  });
  await prisma.designFile.create({
    data: {
      taskId: t4.id,
      version: 1,
      fileName: "electrical-l3-v1.pdf",
      fileType: "pdf",
      fileSize: SAMPLE_PDF.length,
      storageKey: await writeSampleFile(t4.id, "electrical-l3-v1.pdf"),
      uploadedById: priya.id,
    },
  });
  await prisma.review.create({
    data: {
      taskId: t4.id,
      reviewerId: onsite.id,
      version: 1,
      decision: "APPROVED",
      comments: "Looks good. Approved for execution.",
    },
  });

  // 5) Plumbing task (routes to a different team — demonstrates routing)
  await prisma.designTask.create({
    data: {
      projectId: project.id,
      floorId: floor("Ground Floor"),
      categoryId: catId["Plumbing Design"],
      designerId: priya.id,
      deadline: dueIn(8),
      priority: "MEDIUM",
      status: "ASSIGNED",
    },
  });

  console.log("Seed complete.");
  console.log("Login: admin@blueprint.test / designer@blueprint.test / onsite@blueprint.test  (password123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
