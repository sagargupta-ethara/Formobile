import { PrismaClient, FloorType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { drawingRegister, guessSpecialization, guessDiscipline } from "../lib/drawingTypes";
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

  // ---- Master drawing register (template, projectId = null) ----
  for (const d of drawingRegister()) {
    const specName = guessSpecialization(d.name);
    const existing = await prisma.designCategory.findFirst({
      where: { projectId: null, name: d.name },
    });
    if (existing) {
      await prisma.designCategory.update({
        where: { id: existing.id },
        data: { appliesTo: d.appliesTo as FloorType[] },
      });
    } else {
      await prisma.designCategory.create({
        data: {
          name: d.name,
          appliesTo: d.appliesTo as FloorType[],
          specializationId: specName ? specs[specName] : null,
          discipline: guessDiscipline(d.name),
        },
      });
    }
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
  const floorDefs: { floorName: string; floorType: FloorType }[] = [
    { floorName: "Basement", floorType: "BASEMENT" },
    { floorName: "Stilt Floor", floorType: "STILT" },
    { floorName: "Ground Floor", floorType: "FLOOR" },
    { floorName: "First Floor", floorType: "FLOOR" },
    { floorName: "Second Floor", floorType: "FLOOR" },
    { floorName: "Third Floor", floorType: "FLOOR" },
    { floorName: "Terrace", floorType: "TERRACE" },
  ];
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
        create: floorDefs.map((f, order) => ({ ...f, order })),
      },
    },
    include: { floors: true },
  });
  const floor = (n: string) => project.floors.find((f) => f.floorName === n)!.id;

  // the project gets its own copy of the register; demo tasks use the copies
  const template = await prisma.designCategory.findMany({ where: { projectId: null } });
  const catId: Record<string, string> = {};
  for (const t of template) {
    const copy = await prisma.designCategory.create({
      data: {
        name: t.name,
        projectId: project.id,
        specializationId: t.specializationId,
        appliesTo: t.appliesTo,
        discipline: t.discipline,
      },
    });
    catId[t.name] = copy.id;
  }
  // demo team membership
  for (const userId of [admin.id, rahul.id, priya.id, onsite.id]) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId } },
      update: {},
      create: { projectId: project.id, userId },
    });
  }

  const dueIn = (days: number) =>
    new Date(Date.now() + days * 24 * 3600 * 1000);

  // 1) Assigned, no upload yet
  await prisma.designTask.create({
    data: {
      projectId: project.id,
      floorId: floor("Ground Floor"),
      categoryId: catId["Ground Floor Slab Electrical Conduiting Plan"],
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
      categoryId: catId["Wall Electrical + Remote Location"],
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
      categoryId: catId["DB Location"],
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
      categoryId: catId["Automation"],
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
      categoryId: catId["Bathroom Plumbing"],
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
