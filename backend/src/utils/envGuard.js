/**
 * envGuard.js — Protección DEV/PROD para operaciones Turso
 *
 * Regla fail-safe:
 *   TURSO_ENV ausente => asumir PROD
 *   TURSO_ENV=dev    => DEV
 *   TURSO_ENV=prod   => PROD
 */

function getTursoEnv() {
  const env = process.env.TURSO_ENV;
  if (env) return env.toLowerCase();
  return 'prod';
}

function isProd() {
  return getTursoEnv() === 'prod';
}

function isDev() {
  return getTursoEnv() === 'dev';
}

/**
 * Para scripts CLI — bloquea la ejecución si no es DEV.
 * Imprime mensaje de error y termina con process.exit(1).
 */
function requireDevOrConfirm(operationName) {
  const env = getTursoEnv();
  if (env === 'prod') {
    console.error('');
    console.error('╔══════════════════════════════════════════════════╗');
    console.error('║  OPERACION BLOQUEADA                            ║');
    console.error('╠══════════════════════════════════════════════════╣');
    console.error('║  Operacion: ' + operationName.padEnd(37) + '║');
    console.error('║  Entorno detectado: PROD                         ║');
    console.error('║                                                  ║');
    console.error('║  Para ejecutar en DEV, establece:                ║');
    console.error('║    export TURSO_ENV=dev                          ║');
    console.error('║                                                  ║');
    console.error('║  Esta operacion esta bloqueada en PROD.          ║');
    console.error('╚══════════════════════════════════════════════════╝');
    console.error('');
    process.exit(1);
  }
}

/**
 * Para endpoints HTTP — retorna false si la operación debe bloquearse.
 * Si retorna false, ya envió la respuesta HTTP 403.
 * Si retorna true, la operación está permitida (DEV).
 */
function requireDevOrReject(req, res, operationName) {
  const env = getTursoEnv();
  if (env === 'prod') {
    res.status(403).json({
      error: 'Operacion bloqueada: ' + operationName,
      message: 'Esta operacion solo esta disponible en entorno DEV.',
      env: env,
    });
    return false;
  }
  return true;
}

/**
 * Retorna la URL de Turso de forma segura (sin token).
 * Muestra solo el host, nunca el auth token.
 */
function safeUrl(url) {
  if (!url) return '(no configurada)';
  try {
    const parsed = new URL(url);
    return parsed.protocol + '//' + parsed.hostname;
  } catch {
    return url.replace(/\?.*$/, '').substring(0, 80);
  }
}

/**
 * Imprime banner de entorno antes de una operación.
 */
function printEnvBanner(operationName) {
  const env = getTursoEnv();
  const url = safeUrl(process.env.TURSO_URL);
  console.log('');
  console.log('========================================');
  console.log('  ENTORNO: ' + env.toUpperCase());
  console.log('  Operacion: ' + operationName);
  console.log('  Destino: ' + url);
  console.log('========================================');
  console.log('');
}

module.exports = {
  getTursoEnv,
  isProd,
  isDev,
  requireDevOrConfirm,
  requireDevOrReject,
  safeUrl,
  printEnvBanner,
};
