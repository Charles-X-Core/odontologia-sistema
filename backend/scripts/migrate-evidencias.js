const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'clinica.db');
const UPLOADS_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const db = new DatabaseSync(DB_PATH);

function computeHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch {
    return '';
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function formatTime(d) {
  return d.toTimeString().slice(0, 5).replace(':', '-');
}

function migrate() {
  console.log('[MIGRATE] Starting evidencias migration...');

  const imagenes = db.prepare('SELECT * FROM imagenes ORDER BY id').all();
  console.log(`[MIGRATE] Found ${imagenes.length} images to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const img of imagenes) {
    const oldPath = path.join(UPLOADS_DIR, img.archivo_nombre);

    if (!fs.existsSync(oldPath)) {
      console.log(`[MIGRATE] SKIP: File not found: ${img.archivo_nombre}`);
      skipped++;
      continue;
    }

    try {
      const created = img.created_at ? new Date(img.created_at) : new Date();
      const dateStr = formatDate(created);
      const timeStr = formatTime(created);
      const ext = path.extname(img.archivo_original);

      const tipoStr = img.tipo || 'foto';
      const newFilename = `${dateStr}_${timeStr}_${tipoStr}${ext}`;

      const pacienteId = img.paciente_id || 'unknown';
      const consultaId = img.consulta_id || 'unknown';
      const newDir = path.join(UPLOADS_DIR, 'evidencias', String(pacienteId), String(consultaId));
      ensureDir(newDir);

      const newPath = path.join(newDir, newFilename);
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);

      const hash = computeHash(newPath);
      const archivoNombre = path.relative(UPLOADS_DIR, newPath).replace(/\\/g, '/');

      db.prepare(`
        UPDATE imagenes SET archivo_nombre = ?, hash_sha256 = ? WHERE id = ?
      `).run(archivoNombre, hash, img.id);

      console.log(`[MIGRATE] OK: ${img.archivo_nombre} -> ${archivoNombre}`);
      migrated++;
    } catch (err) {
      console.error(`[MIGRATE] ERROR: ${img.archivo_nombre}: ${err.message}`);
      errors++;
    }
  }

  console.log(`[MIGRATE] Done: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
}

migrate();
