/**
 * Sync Routes — API endpoints for synchronization
 *
 * POST /api/sync/push        — Push local changes (bloqueado si bootstrap pendiente sin admitLocalPush)
 * POST /api/sync/pull        — Pull remote changes from Turso
 * POST /api/sync/full        — Full bidirectional sync (bootstrap A1/A2)
 * GET  /api/sync/status      — Get sync status
 * POST /api/sync/rebootstrap — Invalida cursor (restore explícito)
 * POST /api/sync/clean       — Clean local data (Desktop/DEV only, admin)
 *
 * /clean no se registra en Vercel (includeClean=false / VERCEL=1).
 * No cambiar el comportamiento de fullSync/push/pull.
 */

const express = require('express');
const syncService = require('./syncService');
const { auth, requireRole } = require('../middleware/auth');
const { requireDevOrReject } = require('../utils/envGuard');
const { CLEAN_TABLES } = syncService;

function createSyncRouter({ includeClean = true } = {}) {
  const router = express.Router();

  // All sync routes require authentication
  router.use(auth);

  /**
   * POST /api/sync/push
   * Push local changes to Turso
   *
   * C4.2.5.1: con last_sync_at NULL (bootstrap pendiente) el push total está prohibido
   * salvo admitLocalPush===true y solo en escenario A2 (nunca A1).
   */
  router.post('/push', async (req, res) => {
    try {
      const body = req.body || {};
      const admitLocalPush = body.admitLocalPush === true;
      const lastSync = syncService.getLastSyncTime();

      if (!lastSync) {
        if (!admitLocalPush) {
          return res.status(409).json({
            success: false,
            error: 'BOOTSTRAP_PENDING',
            code: 'BOOTSTRAP_PENDING',
            message:
              'Bootstrap pendiente: push total prohibido sin admitLocalPush=true. Use POST /api/sync/full.'
          });
        }

        const scenario = syncService.classifyBootstrapScenario();
        if (scenario.scenario === 'A1_empty') {
          return res.status(409).json({
            success: false,
            error: 'BOOTSTRAP_A1_PULL_ONLY',
            code: 'BOOTSTRAP_A1_PULL_ONLY',
            message:
              'Escenario A1 es pull-only: push de contenido prohibido incluso con admitLocalPush.'
          });
        }

        const admitted = await syncService.pushToTurso(null);
        if (admitted.success) {
          return res.json({
            success: true,
            message: 'Push admitido (A2) — no avanza last_sync_at',
            data: admitted
          });
        }
        return res.status(500).json({
          success: false,
          error: admitted.error || 'Error al subir cambios (admitLocalPush)'
        });
      }

      const result = await syncService.pushToTurso(body.since || null);

      if (result.success) {
        res.json({
          success: true,
          message: 'Cambios locales subidos a Turso',
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Error al subir cambios'
        });
      }
    } catch (error) {
      console.error('Sync push error:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * POST /api/sync/pull
   * Pull remote changes from Turso
   */
  router.post('/pull', async (req, res) => {
    try {
      const { since } = req.body;
      const result = await syncService.pullFromTurso(since || null);

      if (result.success) {
        res.json({
          success: true,
          message: 'Cambios remotos descargados',
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Error al descargar cambios'
        });
      }
    } catch (error) {
      console.error('Sync pull error:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * POST /api/sync/full
   * Full bidirectional sync
   */
  router.post('/full', async (req, res) => {
    try {
      const result = await syncService.fullSync();

      res.json({
        success: result.success,
        message: result.success
          ? `Sincronizacion completa en ${result.duration}ms`
          : 'Sincronizacion con errores',
        data: result
      });
    } catch (error) {
      console.error('Sync full error:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * GET /api/sync/status
   * Get sync status
   */
  router.get('/status', (req, res) => {
    try {
      const status = syncService.getSyncStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Sync status error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estado'
      });
    }
  });

  /**
   * POST /api/sync/rebootstrap
   * Invalida el cursor (restore / re-clasificación A2/A3). No borra datos.
   */
  router.post('/rebootstrap', (req, res) => {
    try {
      const result = syncService.invalidateCursor(req.body && req.body.reason
        ? String(req.body.reason)
        : 'manual');
      res.json({
        success: result.success,
        message: 'Cursor invalidado; el próximo fullSync ejecutará bootstrap',
        data: result
      });
    } catch (error) {
      console.error('Sync rebootstrap error:', error);
      res.status(500).json({ success: false, error: 'Error al invalidar cursor' });
    }
  });

  if (includeClean) {
    /**
     * POST /api/sync/clean
     * Clean local data (for fresh import) — DEV + admin + BORRAR TODO + whitelist
     */
    router.post('/clean', requireRole('admin'), async (req, res) => {
      if (!requireDevOrReject(req, res, 'sync/clean')) return;

      const { tables, confirmation } = req.body || {};
      if (confirmation !== 'BORRAR TODO') {
        return res.status(400).json({ error: 'Confirmacion incorrecta. Envía "BORRAR TODO"' });
      }

      let target = null;
      if (tables != null) {
        if (!Array.isArray(tables)) {
          return res.status(400).json({ error: 'tables debe ser un array' });
        }
        const invalid = tables.filter((t) => !CLEAN_TABLES.includes(t));
        if (invalid.length > 0) {
          return res.status(400).json({
            error: 'Tablas fuera de CLEAN_TABLES: ' + invalid.join(', '),
          });
        }
        target = tables;
      }

      try {
        const result = syncService.cleanLocalData(target);
        res.json({
          success: true,
          message: 'Datos limpiados',
          data: result
        });
      } catch (error) {
        if (error && error.message && error.message.includes('CLEAN_TABLES')) {
          return res.status(400).json({ error: error.message });
        }
        console.error('Sync clean error:', error);
        res.status(500).json({
          success: false,
          error: 'Error al limpiar datos'
        });
      }
    });
  }

  return router;
}

// Desktop por defecto incluye /clean; Vercel/VERCEL no la registra
const router = createSyncRouter({ includeClean: !process.env.VERCEL });

module.exports = router;
module.exports.createSyncRouter = createSyncRouter;
