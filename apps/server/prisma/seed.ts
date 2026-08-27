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

export async function seed() {
  const prisma = new PrismaClient();
  try {
    const yamlPath = path.resolve(__dirname, 'seed-users.yaml');
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`seed-users.yaml not found at ${yamlPath}`);
    }

    const raw = fs.readFileSync(yamlPath, 'utf-8');
    const config = yaml.parse(raw) as { users: SeedUser[] };
    const users = config.users ?? [];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      await prisma.user.upsert({
        where: { username: u.username },
        update: { passwordHash: hash, role: u.role || 'admin' },
        create: {
          username: u.username,
          passwordHash: hash,
          role: u.role || 'admin',
        },
      });
      console.log(`User upserted: ${u.username}`);
    }

    console.log('Seed complete');
  } finally {
    await prisma.$disconnect();
  }
}

export async function createUser(username: string, password: string, role = 'admin') {
  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { username },
      update: { passwordHash: hash, role },
      create: { username, passwordHash: hash, role },
    });
    console.log(`User created/updated: ${username}`);
  } finally {
    await prisma.$disconnect();
  }
}

export async function run(argv = process.argv) {
  if (!argv.includes('--username')) {
    await seed();
    return;
  }

  const usernameIdx = argv.indexOf('--username');
  const passwordIdx = argv.indexOf('--password');
  const roleIdx = argv.indexOf('--role');

  if (usernameIdx === -1 || passwordIdx === -1) {
    console.error('Usage: ts-node seed.ts --username xxx --password xxx [--role admin]');
    process.exit(1);
  }

  const username = argv[usernameIdx + 1];
  const password = argv[passwordIdx + 1];
  const role = roleIdx !== -1 ? argv[roleIdx + 1] : 'admin';

  await createUser(username, password, role);
}

// CLI mode: db:create-user --username xxx --password xxx --role admin
if (require.main === module) {
  void run();
}
