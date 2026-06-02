const express = require('express');
const cors = require('cors');
const path = require('path');
const { auth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowed = [
      'http://localhost:5173',
      'http://localhost:3001',
      'http://localhost:18234',
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    if (origin.includes('vercel.app')) {
      return callback(null, true);
    }

    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pacientes', auth, require('./routes/pacientes'));
app.use('/api/historias', auth, require('./routes/historias'));
app.use('/api/consultas', auth, require('./routes/consultas'));
app.use('/api/odontogramas', auth, require('./routes/odontogramas'));
app.use('/api/tratamientos', auth, require('./routes/tratamientos'));
app.use('/api/recetas', auth, require('./routes/recetas'));
app.use('/api/imagenes', auth, require('./routes/imagenes'));
app.use('/api/necesidades', auth, require('./routes/necesidades'));
app.use('/api/pagos', auth, require('./routes/pagos'));
app.use('/api/dashboard', auth, require('./routes/dashboard'));
app.use('/api/importacion', auth, require('./routes/importacion'));
app.use('/api/pdf', auth, require('./routes/pdf'));
app.use('/api/whatsapp', auth, require('./routes/whatsapp'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend dist as static files AFTER all API routes
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendPath));

// Catch-all: serve index.html for any non-API route (SPA fallback)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
