const fs = require('fs');
const path = require('path');

const portableDir = path.join(__dirname, '..', 'portable');
const targetDirs = [
  path.join(__dirname, '..', 'dist-electron', 'win-unpacked'),
];

if (!fs.existsSync(portableDir)) {
  console.error('[copy-portable] portable/ no existe, saltando');
  process.exit(0);
}

const files = fs.readdirSync(portableDir);
let copied = 0;

for (const targetDir of targetDirs) {
  if (!fs.existsSync(targetDir)) continue;
  for (const file of files) {
    const src = path.join(portableDir, file);
    const dest = path.join(targetDir, file);
    try {
      fs.copyFileSync(src, dest);
      console.log('[copy-portable] ' + file + ' -> ' + path.basename(targetDir));
      copied++;
    } catch (e) {
      console.error('[copy-portable] Error copiando ' + file + ': ' + e.message);
    }
  }
}

console.log('[copy-portable] Total: ' + copied + ' archivos copiados');
