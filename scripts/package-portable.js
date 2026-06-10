const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist-electron');
const PORTABLE_NAME = 'Vita Mirabilis';

console.log('[package-portable] Empaquetando version portable...');

// Buscar exe portable (puede ser "Vita Mirabilis.exe" o "Vita Mirabilis 1.0.0.exe")
let portableExe = path.join(DIST, `${PORTABLE_NAME}.exe`);
if (!fs.existsSync(portableExe)) {
  const exes = fs.readdirSync(DIST).filter(f => f.endsWith('.exe'));
  const match = exes.find(f => f.includes(PORTABLE_NAME) && !f.includes('Uninstall'));
  if (match) portableExe = path.join(DIST, match);
}

if (!fs.existsSync(portableExe)) {
  console.error('[package-portable] ERROR: No se encontro exe portable en dist-electron/');
  console.error('[package-portable] Ejecuta primero: npm run build:portable');
  process.exit(1);
}

// Crear carpeta temporal de empaquetado
const stagingDir = path.join(DIST, 'portable-staging');
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true });
fs.mkdirSync(stagingDir, { recursive: true });

// Copiar exe portable
fs.copyFileSync(portableExe, path.join(stagingDir, `${PORTABLE_NAME}.exe`));
console.log(`[package-portable] Copiado: ${PORTABLE_NAME}.exe (from ${path.basename(portableExe)})`);

// Copiar carpeta portable (bat, readme, verificar)
const portableDir = path.join(ROOT, 'portable');
if (fs.existsSync(portableDir)) {
  for (const file of fs.readdirSync(portableDir)) {
    fs.copyFileSync(path.join(portableDir, file), path.join(stagingDir, file));
    console.log(`[package-portable] Copiado: ${file}`);
  }
}

// Crear ZIP con PowerShell (write temp .ps1 to avoid quote escaping issues)
const zipPath = path.join(DIST, `${PORTABLE_NAME}-portable.zip`);
const ps1File = path.join(DIST, '_compress.ps1');
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
  if (fs.existsSync(ps1File)) fs.unlinkSync(ps1File);

  const ps1Content = `Compress-Archive -Path "${stagingDir}\\*" -DestinationPath "${zipPath}" -CompressionLevel Optimal`;
  fs.writeFileSync(ps1File, ps1Content, 'utf8');
  execSync(`powershell -ExecutionPolicy Bypass -File "${ps1File}"`, { stdio: 'inherit' });
  if (fs.existsSync(ps1File)) fs.unlinkSync(ps1File);
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
