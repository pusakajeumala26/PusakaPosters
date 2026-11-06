import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function toTitleCase(name) {
  return name.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('id').replace(/(^|[\s'-])(\p{L})/gu,
    (_match, separator, letter) => separator + letter.toLocaleUpperCase('id'));
}

try {
  const members = await prisma.member.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } });
  let changed = 0;
  for (const member of members) {
    const name = toTitleCase(member.name);
    if (name === member.name) continue;
    console.log(`${member.name} => ${name}${dryRun ? ' (dry-run)' : ''}`);
    changed++;
    if (!dryRun) await prisma.member.update({ where: { id: member.id }, data: { name } });
  }
  console.log(`${dryRun ? 'Akan diperbarui' : 'Diperbarui'}: ${changed} dari ${members.length} nama.`);
} finally {
  await prisma.$disconnect();
}
