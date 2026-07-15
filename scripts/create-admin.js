/**
 * Creates an admin account. There is no public admin signup
 * page (that would be a security hole), so this is how the
 * first — and any subsequent — admin gets created.
 *
 * Usage (interactive, recommended — avoids the password ending
 * up in shell history):
 *   node scripts/create-admin.js
 *
 * Usage (non-interactive, e.g. for scripted deployment):
 *   node scripts/create-admin.js --name "Jane Doe" --email jane@vidyaniti.com --password "..." --role super_admin
 *
 * Goes through the normal app config (src/config/env.js), same
 * as the import script — requires SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in .env, not DATABASE_URL.
 */
'use strict';

const readline = require('readline');
const adminRepository = require('../src/repositories/admin.repository');
const adminAuthService = require('../src/services/adminAuth.service');

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

/**
 * Prompts for a password without echoing it to the terminal.
 * A small, dependency-free masked-input implementation using
 * raw stdin mode — good enough for an occasional admin-creation
 * task, not meant to be a general-purpose prompt library.
 */
function askPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
        return;
      }
      if (char === '\u0003') {
        process.exit(1); // Ctrl+C
      }
      if (char === '\u007f' || char === '\b') {
        password = password.slice(0, -1);
        return;
      }
      password += char;
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const args = parseArgs();

  const name = args.name || (await ask('Admin name: '));
  const email = (args.email || (await ask('Admin email: '))).trim().toLowerCase();
  const password = args.password || (await askPassword('Admin password (min 8 characters): '));
  const role = args.role || 'admin';

  if (!name || !email || !password) {
    console.error('Name, email, and password are all required.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('That does not look like a valid email address.');
    process.exit(1);
  }

  const existing = await adminRepository.findByEmail(email);
  if (existing) {
    console.error(`An admin with email "${email}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await adminAuthService.hashPassword(password);
  const admin = await adminRepository.create({
    name,
    email,
    password_hash: passwordHash,
    role,
    is_active: true,
  });

  console.log(`\nAdmin account created: ${admin.name} <${admin.email}> (role: ${admin.role})`);
  console.log('You can now log in at /admin/login');
}

main().catch((err) => {
  console.error('\nFailed to create admin:', err.message);
  process.exit(1);
});
