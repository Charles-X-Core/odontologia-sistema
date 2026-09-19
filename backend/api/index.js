/**
 * Vercel Serverless Function — Express API
 * 
 * This file wraps the Express app for Vercel's serverless runtime.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy for rate limiting
app.set('trust proxy', 1);

// Request logging (minimal for serverless)
app.use((req, res, next) => {
  if (req.path !== '/api/health') {
    console.log(`[VERCEL] ${req.method} ${req.path}`);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'vercel'
  });
});

// API Routes
const { authMiddleware } = require('../src/middleware/auth');
const auth = authMiddleware;

try {
  app.use('/api/auth', require('../src/routes/auth'));
  console.log('[VERCEL] /api/auth OK');
} catch(e) { console.error('[VERCEL] /api/auth error:', e.message); }

try {
  app.use('/api/pacientes', auth, require('../src/routes/pacientes'));
  console.log('[VERCEL] /api/pacientes OK');
} catch(e) { console.error('[VERCEL] /api/pacientes error:', e.message); }

try {
  app.use('/api/historias', auth, require('../src/routes/historias'));
  console.log('[VERCEL] /api/historias OK');
} catch(e) { console.error('[VERCEL] /api/historias error:', e.message); }

try {
  app.use('/api/consultas', auth, require('../src/routes/consultas'));
  console.log('[VERCEL] /api/consultas OK');
} catch(e) { console.error('[VERCEL] /api/consultas error:', e.message); }

try {
  app.use('/api/odontogramas', auth, require('../src/routes/odontogramas'));
  console.log('[VERCEL] /api/odontogramas OK');
} catch(e) { console.error('[VERCEL] /api/odontogramas error:', e.message); }

try {
  app.use('/api/tratamientos', auth, require('../src/routes/tratamientos'));
  console.log('[VERCEL] /api/tratamientos OK');
} catch(e) { console.error('[VERCEL] /api/tratamientos error:', e.message); }

try {
  app.use('/api/recetas', auth, require('../src/routes/recetas'));
  console.log('[VERCEL] /api/recetas OK');
} catch(e) { console.error('[VERCEL] /api/recetas error:', e.message); }

try {
  app.use('/api/imagenes', auth, require('../src/routes/imagenes'));
  console.log('[VERCEL] /api/imagenes OK');
} catch(e) { console.error('[VERCEL] /api/imagenes error:', e.message); }

try {
  app.use('/api/necesidades', auth, require('../src/routes/necesidades'));
  console.log('[VERCEL] /api/necesidades OK');
} catch(e) { console.error('[VERCEL] /api/necesidades error:', e.message); }

try {
  app.use('/api/pagos', auth, require('../src/routes/pagos'));
  console.log('[VERCEL] /api/pagos OK');
} catch(e) { console.error('[VERCEL] /api/pagos error:', e.message); }

try {
  app.use('/api/citas', auth, require('../src/routes/citas'));
  console.log('[VERCEL] /api/citas OK');
} catch(e) { console.error('[VERCEL] /api/citas error:', e.message); }

try {
  app.use('/api/dashboard', auth, require('../src/routes/dashboard'));
  console.log('[VERCEL] /api/dashboard OK');
} catch(e) { console.error('[VERCEL] /api/dashboard error:', e.message); }

try {
  app.use('/api/importacion', auth, require('../src/routes/importacion'));
  console.log('[VERCEL] /api/importacion OK');
} catch(e) { console.error('[VERCEL] /api/importacion error:', e.message); }

try {
  app.use('/api/exportacion', auth, require('../src/routes/exportacion'));
  console.log('[VERCEL] /api/exportacion OK');
} catch(e) { console.error('[VERCEL] /api/exportacion error:', e.message); }

try {
  app.use('/api/pdf', auth, require('../src/routes/pdf'));
  console.log('[VERCEL] /api/pdf OK');
} catch(e) { console.error('[VERCEL] /api/pdf error:', e.message); }

try {
  app.use('/api/whatsapp', auth, require('../src/routes/whatsapp'));
  console.log('[VERCEL] /api/whatsapp OK');
} catch(e) { console.error('[VERCEL] /api/whatsapp error:', e.message); }

try {
  app.use('/api/sync', require('../src/sync/syncRoutes'));
  console.log('[VERCEL] /api/sync OK');
} catch(e) { console.error('[VERCEL] /api/sync error:', e.message); }

try {
  app.use('/api/backup', require('../src/routes/backup'));
  console.log('[VERCEL] /api/backup OK');
} catch(e) { console.error('[VERCEL] /api/backup error:', e.message); }

// Serve static files from uploads (for Vercel, use external storage)
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint no encontrado' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[VERCEL] Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Export for Vercel serverless
module.exports = app;
