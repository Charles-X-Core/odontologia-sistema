const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { auth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('[INDEX] Starting...');
console.log('[INDEX] PORT:', PORT);
console.log('[INDEX] __dirname:', __dirname);

try {
  app.use(cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = [
        'http://localhost:5173',
        'http://localhost:3001',
        'http://localhost:18234',
        process.env.FRONTEND_URL,
      ].filter(Boolean);
      if (allowed.includes(origin)) return callback(null, true);
      if (origin.includes('vercel.app')) return callback(null, true);
      callback(null, true);
    },
    credentials: true,
  }));
  console.log('[INDEX] CORS OK');
} catch(e) { console.error('[INDEX] CORS error:', e.message); }

try {
  app.use(express.json());
  console.log('[INDEX] express.json OK');
} catch(e) { console.error('[INDEX] json error:', e.message); }

try {
  app.use('/api/auth', require('./routes/auth'));
  console.log('[INDEX] /api/auth OK');
} catch(e) { console.error('[INDEX] /api/auth error:', e.message, e.stack); }

try {
  app.use('/api/pacientes', auth, require('./routes/pacientes'));
  console.log('[INDEX] /api/pacientes OK');
} catch(e) { console.error('[INDEX] /api/pacientes error:', e.message); }

try {
  app.use('/api/historias', auth, require('./routes/historias'));
  console.log('[INDEX] /api/historias OK');
} catch(e) { console.error('[INDEX] /api/historias error:', e.message); }

try {
  app.use('/api/consultas', auth, require('./routes/consultas'));
  console.log('[INDEX] /api/consultas OK');
} catch(e) { console.error('[INDEX] /api/consultas error:', e.message); }

try {
  app.use('/api/odontogramas', auth, require('./routes/odontogramas'));
  console.log('[INDEX] /api/odontogramas OK');
} catch(e) { console.error('[INDEX] /api/odontogramas error:', e.message); }

try {
  app.use('/api/tratamientos', auth, require('./routes/tratamientos'));
  console.log('[INDEX] /api/tratamientos OK');
} catch(e) { console.error('[INDEX] /api/tratamientos error:', e.message); }

try {
  app.use('/api/recetas', auth, require('./routes/recetas'));
  console.log('[INDEX] /api/recetas OK');
} catch(e) { console.error('[INDEX] /api/recetas error:', e.message); }

try {
  app.use('/api/imagenes', auth, require('./routes/imagenes'));
  console.log('[INDEX] /api/imagenes OK');
} catch(e) { console.error('[INDEX] /api/imagenes error:', e.message); }

try {
  app.use('/api/necesidades', auth, require('./routes/necesidades'));
  console.log('[INDEX] /api/necesidades OK');
} catch(e) { console.error('[INDEX] /api/necesidades error:', e.message); }

try {
  app.use('/api/pagos', auth, require('./routes/pagos'));
  console.log('[INDEX] /api/pagos OK');
} catch(e) { console.error('[INDEX] /api/pagos error:', e.message); }

try {
  app.use('/api/dashboard', auth, require('./routes/dashboard'));
  console.log('[INDEX] /api/dashboard OK');
} catch(e) { console.error('[INDEX] /api/dashboard error:', e.message); }

try {
  app.use('/api/importacion', auth, require('./routes/importacion'));
  console.log('[INDEX] /api/importacion OK');
} catch(e) { console.error('[INDEX] /api/importacion error:', e.message); }

try {
  app.use('/api/exportacion', auth, require('./routes/exportacion'));
  console.log('[INDEX] /api/exportacion OK');
} catch(e) { console.error('[INDEX] /api/exportacion error:', e.message); }

try {
  app.use('/api/pdf', auth, require('./routes/pdf'));
  console.log('[INDEX] /api/pdf OK');
} catch(e) { console.error('[INDEX] /api/pdf error:', e.message); }

try {
  app.use('/api/whatsapp', auth, require('./routes/whatsapp'));
  console.log('[INDEX] /api/whatsapp OK');
} catch(e) { console.error('[INDEX] /api/whatsapp error:', e.message); }

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
console.log('[INDEX] Frontend path:', frontendPath);
console.log('[INDEX] Frontend exists:', require('fs').existsSync(frontendPath));

app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

console.log('[INDEX] All routes registered. Starting HTTP server...');

const server = http.createServer(app);

server.on('error', (err) => {
  console.error('[INDEX] HTTP Server error:', err.code, err.message);
});

server.on('listening', () => {
  console.log('[INDEX] Server LISTENING on port', PORT);
  const addr = server.address();
  console.log('[INDEX] Server address:', addr);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[INDEX] SUCCESS: Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = server;
