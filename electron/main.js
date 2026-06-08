const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
const openwaSetup = require('./openwaSetup');

let mainWindow;
const PORT = 18234;
let serverStarted = false;

// Validar process.env con fallbacks seguros
function safeEnv(key, fallback) {
  return process.env[key] || fallback;
}

function getDataPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'data');
  return path.join(__dirname, '..', 'backend');
}

// Health check: verifica dependencias criticas antes de iniciar
function checkSystemHealth() {
  const result = { ok: true, missing: [], warnings: [] };

  // 1. VC++ Runtime (vcruntime140.dll + msvcp140.dll)
  if (process.platform === 'win32') {
    const sysRoot = safeEnv('SystemRoot', 'C:\\Windows');
    const hasVc = fs.existsSync(path.join(sysRoot, 'System32', 'vcruntime140.dll'))
      && fs.existsSync(path.join(sysRoot, 'System32', 'msvcp140.dll'));
    if (!hasVc) {
      result.missing.push('Visual C++ Runtime 2015+ (https://aka.ms/vs/17/release/vc_redist.x64.exe)');
      result.ok = false;
    }
  }

  // 2. Google Chrome (delegado a chromeFinder compartido)
  const { findChrome } = require('../backend/src/utils/chromeFinder');
  const hasChrome = findChrome() !== null;
  if (!hasChrome) {
    result.missing.push('Google Chrome (https://www.google.com/chrome/)');
    result.ok = false;
  }

  // 3. Node.js o Electron (siempre presente en dist, solo warning en dev)
  const hasNode = fs.existsSync('C:\\Program Files\\nodejs\\node.exe')
    || fs.existsSync('C:\\Program Files (x86)\\nodejs\\node.exe')
    || fs.existsSync(path.join(safeEnv('LOCALAPPDATA', ''), 'nodejs', 'node.exe'));
  if (!hasNode) {
    result.warnings.push('Node.js no detectado (se usara el runtime de Electron, esto es normal)');
  }

  return result;
}

// Matar procesos que usan un puerto especifico (Windows)
function killPortProcess(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = output.trim().split('\n').filter(l => l.trim());
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`[MAIN] Mato proceso PID ${pid} en puerto ${port}`);
        } catch (e) {}
      }
    }
  } catch (e) {
    // netstat no encontro nada o error — no hay problema
  }
}

function ensureDatabase(dataPath) {
  const dbPath = path.join(dataPath, 'clinica.db');
  if (!fs.existsSync(dbPath)) {
    console.log('[MAIN] Creating new database...');
    process.env.DB_PATH = dbPath;
    process.env.PORT = PORT;
    process.env.JWT_SECRET = 'vita-mirabilis-desktop-secret';
    try {
      require(path.join(__dirname, '..', 'backend', 'src', 'seed.js'));
      console.log('[MAIN] Seed completed');
    } catch (e) {
      console.error('[MAIN] Seed error:', e.message);
    }
  }
  return dbPath;
}

function startBackend() {
  if (serverStarted) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      // Verificar si el puerto esta en uso y matar proceso previo
      killPortProcess(PORT);

      const dataPath = getDataPath();
      console.log('[MAIN] Data path:', dataPath);

      if (!fs.existsSync(dataPath)) {
        console.log('[MAIN] Creating data directory');
        fs.mkdirSync(dataPath, { recursive: true });
      }

      const dbPath = ensureDatabase(dataPath);
      const uploadsPath = path.join(dataPath, 'uploads');
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
        console.log('[MAIN] Created uploads directory');
      }

      process.env.PORT = PORT;
      process.env.DB_PATH = dbPath;
      process.env.UPLOAD_DIR = uploadsPath;
      process.env.JWT_SECRET = 'vita-mirabilis-desktop-secret';
      process.env.FRONTEND_URL = '*';

      const indexPath = path.join(__dirname, '..', 'backend', 'src', 'index.js');
      console.log('[MAIN] Loading index.js from:', indexPath);
      console.log('[MAIN] index.js exists:', fs.existsSync(indexPath));

      console.log('[MAIN] Requiring index.js...');
      const server = require(indexPath);
      console.log('[MAIN] index.js required successfully. Server:', typeof server);

      serverStarted = true;
      console.log('[MAIN] Backend is ready on port', PORT);
    } catch (err) {
      console.error('[MAIN] FATAL ERROR starting backend:', err.message);
      console.error('[MAIN] Stack:', err.stack);
    }
    resolve();
  });
}

function waitForServer(timeout = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log('[MAIN] Polling server at localhost:' + PORT);
    const check = () => {
      http.get(`http://localhost:${PORT}/api/health`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          console.log('[MAIN] Server responded:', res.statusCode);
          resolve(true);
        });
      }).on('error', (err) => {
        const elapsed = Date.now() - start;
        if (elapsed > timeout) {
          console.error('[MAIN] Server timeout after', elapsed, 'ms');
          resolve(false);
        } else {
          process.stdout.write('.');
          setTimeout(check, 300);
        }
      });
    };
    check();
  });
}

function registerIPC() {
  ipcMain.handle('check-openwa', async () => await openwaSetup.checkOpenWA());
  ipcMain.handle('start-openwa', async (event) => {
    try {
      return await openwaSetup.startOpenWA((progress) => {
        event.sender.send('setup-progress', progress);
      });
    } catch (err) { return { success: false, error: err.message }; }
  });
  ipcMain.handle('stop-openwa', async () => { await openwaSetup.stopOpenWA(); return { success: true }; });
  ipcMain.handle('setup-whatsapp', async (event) => {
    try {
      const status = await openwaSetup.checkOpenWA();
      if (status.running) return { success: true };
      const result = await openwaSetup.startOpenWA((progress) => {
        event.sender.send('setup-progress', progress);
      });
      if (result.success) {
        const ready = await openwaSetup.waitForOpenWA(60000);
        return { success: ready };
      }
      return result;
    } catch (err) { return { error: err.message }; }
  });
  ipcMain.handle('get-qr', async () => {
    try { return await openwaSetup.getQR(); }
    catch { return { qr: null }; }
  });
  ipcMain.handle('relaunch-app', () => {
    app.relaunch();
    app.exit(0);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    title: 'Vita Mirabilis',
    icon: path.join(__dirname, 'logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#ffffff',
  });

  mainWindow.once('ready-to-show', () => {
    console.log('[MAIN] Window ready to show');
    mainWindow.show();
    checkWhatsAppStatus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('[MAIN] Page failed to load:', code, desc);
  });

  mainWindow.webContents.on('crashed', () => {
    console.error('[MAIN] Renderer process crashed');
  });

  console.log('[MAIN] Loading URL: http://localhost:' + PORT + '/');
  mainWindow.loadURL(`http://localhost:${PORT}/`);
}

async function checkWhatsAppStatus() {
  try {
    const status = await openwaSetup.checkOpenWA();
    if (!status.running) {
      await openwaSetup.startOpenWA();
      await openwaSetup.waitForOpenWA(30000);
    }
  } catch {}
}

app.whenReady().then(async () => {
  console.log('[MAIN] App ready');
  registerIPC();

  // Health check de dependencias
  const health = checkSystemHealth();
  if (!health.ok) {
    console.error('[MAIN] Faltan dependencias:', health.missing);
    const msg = 'Faltan las siguientes dependencias:\n\n'
      + health.missing.map((m, i) => '  ' + (i + 1) + '. ' + m).join('\n')
      + '\n\nSolucion: ejecuta "Iniciar Vita Mirabilis.bat" (incluido en esta carpeta)'
        + '\n       para instalar las dependencias automaticamente.';
    dialog.showErrorBox('Vita Mirabilis - Dependencias Faltantes', msg);
    app.quit();
    return;
  }
  if (health.warnings.length > 0) {
    console.log('[MAIN] Advertencias:', health.warnings);
  }

  await startBackend();
  console.log('[MAIN] startBackend() completed');

  const ready = await waitForServer(15000);
  console.log('[MAIN] waitForServer result:', ready);

  if (ready) {
    createWindow();
  } else {
    console.error('[MAIN] Server did not start in time');
    createWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await openwaSetup.stopOpenWA();
  app.quit();
});
