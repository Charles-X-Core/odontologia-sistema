const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const openwaSetup = require('./openwaSetup');

let mainWindow;
const PORT = 18234;
let serverStarted = false;

function getDataPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'data');
  return path.join(__dirname, '..', 'backend');
}

function getFrontendPath() {
  return path.join(app.getAppPath(), 'frontend', 'dist');
}

function ensureDatabase(dataPath) {
  const dbPath = path.join(dataPath, 'clinica.db');
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found, running seed...');
    process.env.DB_PATH = dbPath;
    process.env.PORT = PORT;
    process.env.JWT_SECRET = 'vita-mirabilis-desktop-secret';
    try { require(path.join(__dirname, '..', 'backend', 'src', 'seed.js')); }
    catch (e) { console.error('Seed error:', e.message); }
  }
  return dbPath;
}

function startBackend() {
  if (serverStarted) return;
  const dataPath = getDataPath();
  const dbPath = ensureDatabase(dataPath);
  const uploadsPath = path.join(dataPath, 'uploads');
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

  process.env.PORT = PORT;
  process.env.DB_PATH = dbPath;
  process.env.UPLOAD_DIR = uploadsPath;
  process.env.JWT_SECRET = 'vita-mirabilis-desktop-secret';
  process.env.FRONTEND_URL = '*';

  try {
    require(path.join(__dirname, '..', 'backend', 'src', 'index.js'));
    serverStarted = true;
    console.log(`Backend started on port ${PORT}`);
  } catch (err) { console.error('Error starting backend:', err); }
}

function registerIPC() {
  ipcMain.handle('check-openwa', async () => await openwaSetup.checkOpenWA());
  ipcMain.handle('start-openwa', async (event) => {
    try {
      const result = await openwaSetup.startOpenWA((progress) => {
        event.sender.send('setup-progress', progress);
      });
      return result;
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
    try {
      return await openwaSetup.getQR();
    } catch { return { qr: null }; }
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true },
    autoHideMenuBar: true, show: false,
  });
  mainWindow.loadURL(`http://localhost:${PORT}/`);
  mainWindow.once('ready-to-show', () => { mainWindow.show(); checkWhatsAppStatus(); });
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function checkWhatsAppStatus() {
  const status = await openwaSetup.checkOpenWA();
  if (!status.running) {
    try {
      await openwaSetup.startOpenWA();
      await openwaSetup.waitForOpenWA(30000);
    } catch {}
  }
}

app.whenReady().then(() => {
  registerIPC();
  startBackend();
  setTimeout(() => { createWindow(); }, 1500);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', async () => {
  await openwaSetup.stopOpenWA();
  app.quit();
});
