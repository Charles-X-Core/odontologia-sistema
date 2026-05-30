const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const PORT = 18234;
let serverStarted = false;

function getDataPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'data');
  }
  return path.join(__dirname, '..', 'backend');
}

function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'frontend', 'dist');
  }
  return path.join(__dirname, '..', 'frontend', 'dist');
}

function ensureDatabase(dataPath) {
  const dbPath = path.join(dataPath, 'clinica.db');
  if (!fs.existsSync(dbPath)) {
    console.log('Database not found, running seed...');
    process.env.DB_PATH = dbPath;
    process.env.PORT = PORT;
    process.env.JWT_SECRET = 'vita-mirabilis-desktop-secret';
    try {
      require(path.join(__dirname, '..', 'backend', 'src', 'seed.js'));
    } catch (e) {
      console.error('Seed error:', e.message);
    }
  }
  return dbPath;
}

function startBackend() {
  if (serverStarted) return;

  const dataPath = getDataPath();
  const dbPath = ensureDatabase(dataPath);
  const uploadsPath = path.join(dataPath, 'uploads');

  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  process.env.PORT = PORT;
  process.env.DB_PATH = dbPath;
  process.env.UPLOAD_DIR = uploadsPath;
  process.env.JWT_SECRET = 'vita-mirabilis-desktop-secret';
  process.env.FRONTEND_URL = '*';

  try {
    require(path.join(__dirname, '..', 'backend', 'src', 'index.js'));
    serverStarted = true;
    console.log(`Backend started on port ${PORT}`);
  } catch (err) {
    console.error('Error starting backend:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Vita Mirabilis',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  const frontendPath = getFrontendPath();
  const indexPath = path.join(frontendPath, 'index.html');

  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();

  setTimeout(() => {
    createWindow();
  }, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
