// One-off / re-runnable sync of the firm's drawing register into the DB:
//  1. upsert every drawing type with its floor zones + routed specialization
//  2. remove old placeholder categories (cascades their demo tasks)
//  3. backfill Floor.floorType from floor names
// Run: npx tsx prisma/sync-catalog.ts
import { PrismaClient, FloorType } from "@prisma/client";
import { drawingRegister, guessSpecialization } from "../lib/drawingTypes";

const prisma = new PrismaClient();

async function main() {
  // specializations referenced by the register
  const specNames = ["Electrical", "Plumbing", "HVAC", "Civil", "Landscape", "Interior"];
  const specs: Record<string, string> = {};
  for (const name of specNames) {
    const s = await prisma.specialization.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    specs[name] = s.id;
  }

  const register = drawingRegister();
  for (const d of register) {
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
        },
      });
    }
  }
  console.log(`Upserted ${register.length} drawing types.`);

  // drop the old dummy categories (anything not in the register)
  const keep = new Set(register.map((d) => d.name));
  const old = await prisma.designCategory.findMany({
    where: { name: { notIn: [...keep] } },
    select: { id: true, name: true },
  });
  if (old.length) {
    await prisma.designCategory.deleteMany({
      where: { id: { in: old.map((o) => o.id) } },
    });
    console.log(
      `Removed ${old.length} old categories (and their demo tasks): ${old
        .map((o) => o.name)
        .join(", ")}`
    );
  }

  // backfill floor types from names
  const floors = await prisma.floor.findMany();
  for (const f of floors) {
    let type: FloorType = "FLOOR";
    if (/basement/i.test(f.floorName)) type = "BASEMENT";
    else if (/stilt/i.test(f.floorName)) type = "STILT";
    else if (/terrace/i.test(f.floorName)) type = "TERRACE";
    if (f.floorType !== type) {
      await prisma.floor.update({ where: { id: f.id }, data: { floorType: type } });
    }
  }
  console.log(`Floor types backfilled for ${floors.length} floors.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
