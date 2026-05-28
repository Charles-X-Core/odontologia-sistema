const express = require('express');
const cors = require('cors');
const { auth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const allowed = [
      'http://localhost:5173',
      'http://localhost:3001',
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
