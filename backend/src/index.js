const express = require('express');
const cors = require('cors');
const { auth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));

app.use('/api/pacientes', auth, require('./routes/pacientes'));
app.use('/api/historias', auth, require('./routes/historias'));
app.use('/api/consultas', auth, require('./routes/consultas'));
app.use('/api/odontogramas', auth, require('./routes/odontogramas'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
