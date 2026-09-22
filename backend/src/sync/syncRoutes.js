/**
 * Sync Routes — API endpoints for synchronization
 * 
 * POST /api/sync/push        — Push local changes to Turso
 * POST /api/sync/pull        — Pull remote changes from Turso
 * POST /api/sync/full        — Full bidirectional sync
 * GET  /api/sync/status      — Get sync status
 * POST /api/sync/clean       — Clean local data
 */

const express = require('express');
const router = express.Router();
const syncService = require('./syncService');
const { auth } = require('../middleware/auth');

// All sync routes require authentication
router.use(auth);

/**
 * POST /api/sync/push
 * Push local changes to Turso
 */
router.post('/push', async (req, res) => {
  try {
    const { since } = req.body;
    const result = await syncService.pushToTurso(since || null);
    
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
 * POST /api/sync/clean
 * Clean local data (for fresh import)
 */
router.post('/clean', async (req, res) => {
  try {
    const { tables } = req.body;
    const result = syncService.cleanLocalData(tables || null);
    
    res.json({
      success: true,
      message: 'Datos limpiados',
      data: result
    });
  } catch (error) {
    console.error('Sync clean error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al limpiar datos'
    });
  }
});

module.exports = router;
