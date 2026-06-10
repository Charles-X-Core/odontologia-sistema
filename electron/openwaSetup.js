// openwaSetup.js - Maneja el ciclo de vida del OpenWA runner
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { app } = require('electron');

const OPENWA_URL = process.env.OPENWA_URL || 'http://localhost:3002';
const OPENWA_PORT = 3002;
let openwaProcess = null;

// En dev: el runner esta en electron/, project root es __dirname/..
// En dist: el runner esta en resources/app/electron/, project root es resources/app
function getProjectRoot() {
  if (app && app.isPackaged) {
    const dir = path.join(process.resourcesPath, 'app');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch(e) {}
    }
    return dir;
  }
  return path.join(__dirname, '..');
}

function getRunnerScriptPath() {
  let dir = __dirname;
  // En produccion (asar), __dirname apunta a app.asar/electron
  // Preferimos app.asar.unpacked/electron si existe (compatible con builds viejos)
  // Si no, usamos app.asar/electron directamente (electron-builder ya no lo desempaqueta)
  if (dir.indexOf('app.asar') !== -1 && dir.indexOf('app.asar.unpacked') === -1) {
    const unpackedDir = dir.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(path.join(unpackedDir, 'openwa-runner.js'))) {
      dir = unpackedDir;
    }
    // Si no existe en unpacked, usar la ruta del asar (funciona porque es solo JS)
  }
  return path.join(dir, 'openwa-runner.js');
}

// Buscar Chrome en el sistema (delegado a chromeFinder compartido)
const { findChrome, installChromeViaWinget } = require('./chromeFinder');

// Instalar Chrome via Puppeteer si no existe
async function installChrome() {
  console.log('[OPENWA-SETUP] Chrome no encontrado, instalando...');
  return new Promise(function(resolve, reject) {
    try {
      // Buscar puppeteer
      let puppeteerPath = null;
      const pupCandidates = [
        path.join(__dirname, '..', 'node_modules', 'puppeteer'),
        path.join(__dirname, '..', '..', 'node_modules', 'puppeteer'),
      ];
      for (const p of pupCandidates) {
        if (fs.existsSync(p)) { puppeteerPath = p; break; }
      }
      if (!puppeteerPath) {
        console.log('[OPENWA-SETUP] Puppeteer (full) no disponible, intentando winget...');
        // Intentar via winget como ultimo recurso
        const { execSync } = require('child_process');
        try {
          execSync('winget install Google.Chrome --accept-package-agreements --accept-source-agreements --silent',
            { stdio: 'inherit', timeout: 300000 });
          resolve(true);
          return;
        } catch (we) {
          console.error('[OPENWA-SETUP] winget Chrome install fallo:', we.message);
          resolve(false);
          return;
        }
      }
      const puppeteer = require(puppeteerPath);
      const browserFetcher = puppeteer.createBrowserFetcher();
      browserFetcher.download('chrome', puppeteer.PUPPETEER_REVISIONS.chromium || '131.0.6778.204')
        .then(() => resolve(true))
        .catch(err => { console.error('[OPENWA-SETUP] Install error:', err.message); resolve(false); });
    } catch (e) {
      console.error('[OPENWA-SETUP] Install exception:', e.message);
      resolve(false);
    }
  });
}

function getRunnerDir() {
  // El wwebjs_auth va junto al script runner
  return __dirname;
}

function getAuthPath() {
  return path.join(getRunnerDir(), 'wwebjs_auth');
}

function checkOpenWA() {
  return new Promise(function(resolve) {
    const req = http.get(OPENWA_URL + '/api/getStatus', { timeout: 5000 }, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          const json = JSON.parse(data);
          resolve({ running: true, connected: json.connected || false, info: json });
        } catch (e) { resolve({ running: false, connected: false }); }
      });
    });
    req.on('error', function() { resolve({ running: false, connected: false }); });
    req.on('timeout', function() { req.destroy(); resolve({ running: false, connected: false }); });
  });
}

function getQR() {
  return new Promise(function(resolve) {
    const req = http.get(OPENWA_URL + '/api/getQR', { timeout: 10000 }, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          const json = JSON.parse(data);
          resolve({ qr: json.qr || null });
        } catch (e) { resolve({ qr: null }); }
      });
    });
    req.on('error', function() { resolve({ qr: null }); });
    req.on('timeout', function() { req.destroy(); resolve({ qr: null }); });
  });
}

async function startOpenWA(onProgress) {
  if (openwaProcess) {
    const s = await checkOpenWA();
    if (s.running) return { success: true };
  }

  if (onProgress) onProgress({ phase: 'starting', message: 'Iniciando WhatsApp Web...' });

  const scriptPath = getRunnerScriptPath();
  console.log('[OPENWA-SETUP] Script path:', scriptPath);
  console.log('[OPENWA-SETUP] Script existe:', fs.existsSync(scriptPath));

  let chromePath = findChrome();
  if (!chromePath) {
    if (onProgress) onProgress({ phase: 'installing', message: 'Instalando Chrome (puede tardar)...' });
    await installChrome();
    chromePath = findChrome();
    if (!chromePath) {
      throw new Error('Chrome no encontrado y no se pudo instalar automaticamente. Por favor instale Google Chrome desde https://www.google.com/chrome/');
    }
    console.log('[OPENWA-SETUP] Chrome instalado en:', chromePath);
  }

  if (!fs.existsSync(scriptPath)) {
    throw new Error('openwa-runner.js no encontrado en: ' + scriptPath);
  }

  let nodeBin = 'C:\\Program Files\\nodejs\\node.exe';
  let useElectronAsNode = false;
  if (fs.existsSync(nodeBin)) {
    console.log('[OPENWA-SETUP] Node bin:', nodeBin);
  } else {
    // Buscar Node.js en otras rutas comunes
    const nodeCandidates = [
      'C:\\Program Files (x86)\\nodejs\\node.exe',
      path.join(process.env.LOCALAPPDATA || '', 'nodejs', 'node.exe'),
      path.join(process.env.APPDATA || '', 'nodejs', 'node.exe'),
      'C:\\nodejs\\node.exe',
    ];
    let found = false;
    for (const p of nodeCandidates) {
      if (fs.existsSync(p)) {
        nodeBin = p;
        found = true;
        console.log('[OPENWA-SETUP] Node bin (alternativo):', nodeBin);
        break;
      }
    }
    if (!found) {
      // Fallback: usar el binario de Electron con ELECTRON_RUN_AS_NODE=1
      // (esto evita requerir Node.js del sistema en PCs nuevas)
      nodeBin = process.execPath;
      useElectronAsNode = true;
      console.log('[OPENWA-SETUP] Node no encontrado, usando Electron como Node:', nodeBin);
    }
  }

  return new Promise(function(resolve, reject) {
    const childEnv = Object.assign({}, process.env);
    if (useElectronAsNode) {
      childEnv.ELECTRON_RUN_AS_NODE = '1';
    }
    const child = spawn(nodeBin, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: Object.assign({}, childEnv, { PORT: '18234' }),
      cwd: getProjectRoot(),
    });

    openwaProcess = child;
    let started = false;
    let output = '';

    child.stdout.on('data', function(d) {
      try {
        const text = d.toString();
        output += text;
        process.stdout.write('[WA-CHILD] ' + text);
        if (!started && text.indexOf('listening on port') !== -1) {
          started = true;
          resolve({ success: true });
        }
      } catch (e) {}
    });

    child.stderr.on('data', function(d) {
      try {
        const text = d.toString();
        output += text;
        process.stderr.write('[WA-CHILD-ERR] ' + text);
      } catch (e) {}
    });

    child.on('close', function(code) {
      console.log('[OPENWA-SETUP] Child process closed, code:', code);
      openwaProcess = null;
      if (!started) {
        reject(new Error('WhatsApp termino con codigo ' + code + ': ' + output.slice(-500)));
      }
    });

    child.on('error', function(err) {
      console.error('[OPENWA-SETUP] Child process error:', err.message);
      openwaProcess = null;
      reject(err);
    });

    setTimeout(function() {
      if (!started) {
        checkOpenWA().then(function(s) {
          if (s.running && !started) { started = true; resolve({ success: true }); }
        });
      }
    }, 15000);

    setTimeout(function() {
      if (!started) {
        started = true;
        resolve({ success: true });
      }
    }, 45000);
  });
}

function stopOpenWA() {
  return new Promise(function(resolve) {
    if (openwaProcess) {
      try { openwaProcess.kill('SIGTERM'); } catch (e) {}
      setTimeout(function() {
        try { openwaProcess.kill('SIGKILL'); } catch (e) {}
        openwaProcess = null;
      }, 3000);
    }
    resolve();
  });
}

async function waitForOpenWA(maxWait) {
  maxWait = maxWait || 60000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const status = await checkOpenWA();
    if (status.running) return true;
    await new Promise(function(r) { setTimeout(r, 2000); });
  }
  return false;
}

module.exports = {
  checkOpenWA: checkOpenWA,
  getQR: getQR,
  startOpenWA: startOpenWA,
  stopOpenWA: stopOpenWA,
  waitForOpenWA: waitForOpenWA,
  OPENWA_URL: OPENWA_URL,
};
