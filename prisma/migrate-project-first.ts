// One-off migration to the project-first model:
//  1. backfill User.department from the staff import mapping
//  2. give every existing project its own copy of the master register
//  3. remap existing tasks from template categories to the project copies
//  4. seed project memberships (admins + everyone already working on it)
// Run: npx tsx prisma/migrate-project-first.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEPARTMENTS: Record<string, string> = {
  "manish.uppal@blueprintflow.in": "Admin",
  "reediima.uppal@blueprintflow.in": "Admin",
  "kanhav.uppal@blueprintflow.in": "Admin",
  "amarpreet.padam@blueprintflow.in": "Interior Design",
  "sanjana.dawar@blueprintflow.in": "Interior Design",
  "nidhi.kamboj@blueprintflow.in": "Interior Design",
  "astha@blueprintflow.in": "Interior Design",
  "pankaj@blueprintflow.in": "Architecture · Structure",
  "kiranpreet@blueprintflow.in": "Architecture · Structure",
  "rajesh@blueprintflow.in": "Architecture · Structure",
  "sewaram.sharma@blueprintflow.in": "Site Head",
  "pradeep.rawat@blueprintflow.in": "Site Head",
  "virender@blueprintflow.in": "Site Head",
  "praveen@blueprintflow.in": "Site Supervisor",
  "zakir@blueprintflow.in": "Site Supervisor",
  "sudama@blueprintflow.in": "Site Supervisor",
  "vijay@blueprintflow.in": "Site Supervisor",
  "nand.kishore@blueprintflow.in": "Site Supervisor",
  "gaurav@blueprintflow.in": "Site Supervisor",
  "rajesh.site@blueprintflow.in": "Site Supervisor",
  "kailash@blueprintflow.in": "Carpentry",
  "dighamber@blueprintflow.in": "MEP · Plumbing",
  "mahesh@blueprintflow.in": "MEP · Electrical",
  "sandeep@blueprintflow.in": "MEP · Electrical",
  "salman@blueprintflow.in": "MEP · HVAC",
};

async function main() {
  // 1. departments
  let depts = 0;
  for (const [email, department] of Object.entries(DEPARTMENTS)) {
    const r = await prisma.user.updateMany({ where: { email }, data: { department } });
    depts += r.count;
  }
  console.log(`Departments set for ${depts} users.`);

  const template = await prisma.designCategory.findMany({ where: { projectId: null } });
  const projects = await prisma.project.findMany({ select: { id: true, name: true } });
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });

  for (const p of projects) {
    // 2. project copy of the register
    const existing = await prisma.designCategory.findMany({
      where: { projectId: p.id },
      select: { id: true, name: true },
    });
    const have = new Map(existing.map((c) => [c.name, c.id]));
    for (const t of template) {
      if (!have.has(t.name)) {
        const created = await prisma.designCategory.create({
          data: {
            name: t.name,
            projectId: p.id,
            specializationId: t.specializationId,
            appliesTo: t.appliesTo,
          },
        });
        have.set(t.name, created.id);
      }
    }

    // 3. remap tasks that still point at template categories
    const tasks = await prisma.designTask.findMany({
      where: { projectId: p.id, category: { projectId: null } },
      include: { category: { select: { name: true } } },
    });
    for (const t of tasks) {
      const target = have.get(t.category.name);
      if (target)
        await prisma.designTask.update({
          where: { id: t.id },
          data: { categoryId: target },
        });
    }

    // 4. memberships: admins + anyone already on tasks/reviews
    const workers = await prisma.designTask.findMany({
      where: { projectId: p.id, designerId: { not: null } },
      select: { designerId: true },
    });
    const memberIds = new Set<string>([
      ...admins.map((a) => a.id),
      ...workers.map((w) => w.designerId!),
    ]);
    for (const userId of memberIds) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: p.id, userId } },
        update: {},
        create: { projectId: p.id, userId },
      });
    }
    console.log(
      `${p.name}: register ${have.size} drawings, ${tasks.length} tasks remapped, ${memberIds.size} members.`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
