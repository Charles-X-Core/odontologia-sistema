require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const { requireDevOrConfirm, printEnvBanner } = require('../src/utils/envGuard');

requireDevOrConfirm('seed-users');
printEnvBanner('seed-users (insert test users)');

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function seedUsers() {
  const users = [
    { nombre: 'Carlos Alonzo', email: 'admin', password: 'admin', rol: 'admin' },
    { nombre: 'Dr. Carlos Alonso', email: 'doctor', password: 'doctor', rol: 'odontologo' },
  ];

  for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    await client.execute({
      sql: 'INSERT OR IGNORE INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
      args: [u.nombre, u.email, hash, u.rol],
    });
    console.log('[Seed] Usuario creado:', u.email);
  }

  const result = await client.execute('SELECT id, email, rol FROM usuarios');
  console.log('[Seed] Usuarios en Turso:', result.rows);
}

seedUsers().catch(e => { console.error(e); process.exit(1); });
