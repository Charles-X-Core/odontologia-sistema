/**
 * seedPolicy — C4.2.5.1
 *
 * Regla seed clínico (pacientes/historias/consultas/... demo):
 * - Sin TURSO_URL → local → SÍ
 * - Con TURSO_URL → solo TURSO_ENV=dev explícito → SÍ (nube DEV)
 *   (hostname con etiqueta "prod" sigue bloqueado)
 * - Cualquier otro caso (PROD o TURSO_ENV ausente con nube) → NO
 *
 * Usuarios de login: no dependen de esta política (seed.js los inserta con OR IGNORE).
 */

const { getTursoEnv } = require('./envGuard');

function shouldSeedClinical() {
  const url = process.env.TURSO_URL;
  if (!url) return true;

  if (getTursoEnv() !== 'dev') return false;

  try {
    const labels = new URL(url).hostname.toLowerCase().split(/[.-]/);
    if (labels.includes('prod')) return false;
  } catch {
    return false;
  }

  return true;
}

function isProdCloudConfigured() {
  return Boolean(process.env.TURSO_URL) && !shouldSeedClinical();
}

module.exports = {
  shouldSeedClinical,
  isProdCloudConfigured,
};
