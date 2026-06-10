const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-electron');
const PORTABLE_NAME = 'Vita Mirabilis';
const PORTABLE_EXE = path.join(DIST, `${PORTABLE_NAME}.exe`);

console.log('[package-portable] Empaquetando version portable...');

// Verificar que el exe portable existe
if (!fs.existsSync(PORTABLE_EXE)) {
  console.error(`[package-portable] ERROR: ${PORTABLE_EXE} no existe`);
  console.error('[package-portable] Ejecuta primero: npm run build:portable');
  process.exit(1);
}

// Crear carpeta temporal de empaquetado
const stagingDir = path.join(DIST, 'portable-staging');
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Copiar exe portable
fs.copyFileSync(PORTABLE_EXE, path.join(stagingDir, `${PORTABLE_NAME}.exe`));
console.log(`[package-portable] Copiado: ${PORTABLE_NAME}.exe`);

// Copiar carpeta portable (bat, readme, verificar)
const portableDir = path.join(ROOT, 'portable');
if (fs.existsSync(portableDir)) {
  for (const file of fs.readdirSync(portableDir)) {
    fs.copyFileSync(path.join(portableDir, file), path.join(stagingDir, file));
    console.log(`[package-portable] Copiado: ${file}`);
  }
}

// Crear ZIP con PowerShell
const zipPath = path.join(DIST, `${PORTABLE_NAME}-portable.zip`);
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  const compressCmd = `Compress-Archive -Path "${stagingDir}\\*" -DestinationPath "${zipPath}" -CompressionLevel Optimal`;
  execSync(`powershell -Command "${compressCmd}"`, { stdio: 'inherit' });
  console.log(`[package-portable] ZIP creado: ${zipPath}`);

  const zipSize = fs.statSync(zipPath).size;
  console.log(`[package-portable] Tamano: ${(zipSize / 1024 / 1024).toFixed(1)} MB`);
} catch (e) {
  console.error(`[package-portable] Error creando ZIP: ${e.message}`);
  process.exit(1);
}

// Limpiar staging
fs.rmSync(stagingDir, { recursive: true });

console.log('[package-portable] Listo! Distribuye Vita Mirabilis-portable.zip');
