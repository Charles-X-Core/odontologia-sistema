/**
 * bootstrapGate — impide escrituras de negocio clínico antes del primer bootstrap.
 *
 * Activo solo si la nube está configurada (TURSO_URL) y last_sync_at es NULL.
 * Sin nube: CRUD local libre (modo solo-local).
 */

const cloudClient = require('../cloudClient');
const syncService = require('../sync/syncService');

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function requireBootstrapIfCloud(req, res, next) {
  if (!cloudClient.isConfigured()) return next();

  let lastSync = null;
  try {
    lastSync = syncService.getLastSyncTime();
  } catch {
    lastSync = null;
  }

  if (lastSync) return next();

  return res.status(409).json({
    error: 'BOOTSTRAP_PENDING',
    code: 'BOOTSTRAP_PENDING',
    message:
      'Sincronizacion inicial pendiente. Complete el bootstrap (POST /api/sync/full) antes de escribir datos clinicos.'
  });
}

function withBootstrapGate(router) {
  router.use((req, res, next) => {
    if (WRITE_METHODS.has(req.method)) {
      return requireBootstrapIfCloud(req, res, next);
    }
    next();
  });
  return router;
}

module.exports = {
  requireBootstrapIfCloud,
  withBootstrapGate,
  WRITE_METHODS
};
