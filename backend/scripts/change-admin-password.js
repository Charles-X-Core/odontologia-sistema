require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireDevOrConfirm, printEnvBanner } = require('../src/utils/envGuard');

requireDevOrConfirm('change-admin-password');
printEnvBanner('change-admin-password');

const client = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Generar contraseña fuerte aleatoria
function generatePassword(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

async function changeAdminPassword() {
  console.log('[Security] Cambiando contraseña del admin...\n');

  // Generar nueva contraseña
  const newPassword = generatePassword(16);
  const hash = bcrypt.hashSync(newPassword, 10);

  // Actualizar en Turso
  await client.execute({
    sql: 'UPDATE usuarios SET password = ? WHERE email = ?',
    args: [hash, 'admin'],
  });

  console.log('========================================');
  console.log('  NUEVA CONTRASEÑA DEL ADMIN');
  console.log('========================================');
  console.log('');
  console.log('  Email:    admin');
  console.log('  Password: ' + newPassword);
  console.log('');
  console.log('  GUARDA ESTA CONTRASEÑA EN UN LUGAR SEGURO');
  console.log('  No se volverá a mostrar.');
  console.log('');
  console.log('========================================');

  // Verificar
  const user = await client.execute({
    sql: 'SELECT id, email, password FROM usuarios WHERE email = ?',
    args: ['admin'],
  });

  if (user.rows.length > 0) {
    const valid = bcrypt.compareSync(newPassword, user.rows[0].password);
    console.log('\n[Security] Verificación:', valid ? 'OK - Contraseña actualizada' : 'ERROR');
  }
}

changeAdminPassword().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
