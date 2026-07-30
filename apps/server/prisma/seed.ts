import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface SeedUser {
  username: string;
  password: string;
  role?: string;
}

async function seed() {
  const prisma = new PrismaClient();

  const yamlPath = path.resolve(__dirname, 'seed-users.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error('seed-users.yaml not found at', yamlPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(yamlPath, 'utf-8');
  const config = yaml.parse(raw) as { users: SeedUser[] };
  const users = config.users ?? [];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: { passwordHash: hash },
      create: {
        username: u.username,
        passwordHash: hash,
        role: u.role || 'admin',
      },
    });
    console.log(`User upserted: ${u.username}`);
  }

  await prisma.$disconnect();
  console.log('Seed complete');
}

// CLI mode: db:create-user --username xxx --password xxx --role admin
if (process.argv.includes('--username')) {
  (async () => {
    const usernameIdx = process.argv.indexOf('--username');
    const passwordIdx = process.argv.indexOf('--password');
    const roleIdx = process.argv.indexOf('--role');

    if (usernameIdx === -1 || passwordIdx === -1) {
      console.error('Usage: ts-node seed.ts --username xxx --password xxx [--role admin]');
      process.exit(1);
    }

    const prisma = new PrismaClient();
    const username = process.argv[usernameIdx + 1];
    const password = process.argv[passwordIdx + 1];
    const role = roleIdx !== -1 ? process.argv[roleIdx + 1] : 'admin';

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash: hash },
      create: { username, passwordHash: hash, role },
    });
    console.log(`User created/updated: ${username}`);
    await prisma.$disconnect();
  })();
} else {
  seed();
}
