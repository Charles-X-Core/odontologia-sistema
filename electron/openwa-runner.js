// OpenWA Runner - Script que corre el cliente de WhatsApp
// Se ejecuta como proceso hijo desde openwaSetup.js
// Path se resuelve relativo a este script via __dirname

const path = require('path');
const fs = require('fs');
const http = require('http');

// Resolver modulos - tanto en dev (npm start) como en dist
let wwjsPath, qrcodePath;

try {
  // Intentar rutas comunes
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js'),
    path.join(__dirname, '..', '..', 'node_modules', 'whatsapp-web.js'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'whatsapp-web.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { wwjsPath = p; break; }
  }
  if (!wwjsPath) wwjsPath = 'whatsapp-web.js';

  const qrCandidates = [
    path.join(__dirname, '..', 'node_modules', 'qrcode'),
    path.join(__dirname, '..', '..', 'node_modules', 'qrcode'),
    path.join(__dirname, '..', '..', '..', 'node_modules', 'qrcode'),
  ];
  for (const p of qrCandidates) {
    if (fs.existsSync(p)) { qrcodePath = p; break; }
  }
  if (!qrcodePath) qrcodePath = 'qrcode';
} catch (e) {
  console.error('[OPENWA] Error resolviendo paths:', e.message);
  wwjsPath = 'whatsapp-web.js';
  qrcodePath = 'qrcode';
}

console.log('[OPENWA] Cargando whatsapp-web.js desde:', wwjsPath);
console.log('[OPENWA] Cargando qrcode desde:', qrcodePath);

const { Client, LocalAuth } = require(wwjsPath);
const qrcode = require(qrcodePath);

// Auth path: FUERA de app.asar.unpacked (Puppeteer tiene problemas con sesiones dentro de asar)
// Usar AppData/Local para que sea escribible y no este dentro de un directorio asar
const appName = 'Vita Mirabilis';
let baseAuthDir;
if (process.env.APPDATA) {
  baseAuthDir = path.join(process.env.APPDATA, appName, 'wwebjs_auth');
} else {
  baseAuthDir = path.join(__dirname, '..', '..', 'wwebjs_auth');
}

// File-based logging (para diagnostico en dist donde stderr se pierde)
const logFile = path.join(process.env.APPDATA || process.env.TEMP || __dirname, appName, 'runner.log');
try {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
} catch (e) {}

// Log levels: INFO, WARN, ERROR, DEBUG
// Format: [TIMESTAMP] [LEVEL] [MODULE] message
// Example: [2025-12-15T10:30:45.123Z] [INFO ] [OPENWA] Auth path: C:\...
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function fmtTime(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth()+1) + '-' + pad2(d.getDate())
    + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
    + '.' + String(d.getMilliseconds()).padStart(3, '0') + 'Z';
}
function fileLog(msg) {
  try {
    const line = '[' + fmtTime(new Date()) + '] ' + msg + '\n';
    fs.appendFileSync(logFile, line);
  } catch (e) {}
}
function levelTag(level) {
  return '[' + (level || 'INFO').padEnd(5) + ']';
}
function logWithLevel(level, module, ...args) {
  const text = levelTag(level) + ' [' + (module || 'APP') + '] ' + args.map(a =>
    typeof a === 'string' ? a : (a && a.stack) ? a.stack : JSON.stringify(a)
  ).join(' ');
  fileLog(text);
}

// Rotar log si excede 5 MB (evita que el archivo crezca infinito)
function rotateLogIfNeeded() {
  try {
    if (!fs.existsSync(logFile)) return;
    const stat = fs.statSync(logFile);
    const MAX_BYTES = 5 * 1024 * 1024;
    if (stat.size < MAX_BYTES) return;
    const backup = logFile + '.old';
    if (fs.existsSync(backup)) fs.unlinkSync(backup);
    fs.renameSync(logFile, backup);
    fileLog('=== LOG ROTATED (prev: ' + stat.size + ' bytes) ===');
  } catch (e) {}
}

fileLog('=== RUNNER STARTED, PID: ' + process.pid + ' ===');
fileLog('=== Node: ' + process.version + ' | Platform: ' + process.platform + ' ===');
fileLog('Log path: ' + logFile);
rotateLogIfNeeded();
fileLog('wwjsPath: ' + wwjsPath);
fileLog('authPath: ' + baseAuthDir);

// Override console.* to also write to file con nivel
const origLog = console.log;
const origErr = console.error;
const origWarn = console.warn || origLog;
const origInfo = console.info || origLog;
const origDebug = console.debug || origLog;

console.log   = function(...args) { logWithLevel('INFO',  'OPENWA', ...args); origLog.apply(console, args); };
console.info  = function(...args) { logWithLevel('INFO',  'OPENWA', ...args); origInfo.apply(console, args); };
console.warn  = function(...args) { logWithLevel('WARN',  'OPENWA', ...args); origWarn.apply(console, args); };
console.error = function(...args) { logWithLevel('ERROR', 'OPENWA', ...args); origErr.apply(console, args); };
console.debug = function(...args) { logWithLevel('DEBUG', 'OPENWA', ...args); origDebug.apply(console, args); };

// Helper para que otros modulos puedan loguear con modulo custom
global.waLog = function(level, module, ...args) {
  logWithLevel(level, module, ...args);
  // Tambien a stdout segun nivel
  const out = (level === 'ERROR') ? origErr : (level === 'WARN' ? origWarn : origLog);
  out.apply(console, ['[' + (module || 'APP') + ']', ...args]);
};

const _origStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function(msg) {
  const text = typeof msg === 'string' ? msg.trim() : String(msg);
  logWithLevel('ERROR', 'STDERR', text);
  return _origStderrWrite(msg);
};

// Manejo de excepciones no capturadas (antes de que el proceso muera)
process.on('uncaughtException', (err) => {
  logWithLevel('ERROR', 'UNCAUGHT', err && err.message);
  if (err && err.stack) logWithLevel('ERROR', 'UNCAUGHT', err.stack);
});
process.on('unhandledRejection', (reason) => {
  logWithLevel('ERROR', 'UNHANDLED', String(reason));
  if (reason && reason.stack) logWithLevel('ERROR', 'UNHANDLED', reason.stack);
});

const authPath = baseAuthDir;
try { if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true }); } catch(e) {}
console.log('[OPENWA] Auth path:', authPath);

// Limpiar sesiones huerfanas (viejas con clientId distinto o corruptas)
function cleanupOrphanSessions() {
  try {
    if (!fs.existsSync(authPath)) return;
    const entries = fs.readdirSync(authPath, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = path.join(authPath, e.name);
      // Eliminar cualquier sesion que no sea la canonica 'session'
      if (e.name !== 'session') {
        try {
          fs.rmSync(p, { recursive: true, force: true });
          console.log('[OPENWA] Sesion huerfana eliminada:', e.name);
        } catch (err) {}
      }
    }
    // Verificar que la sesion canonica tenga un lock file
    const sessionDir = path.join(authPath, 'session');
    if (fs.existsSync(sessionDir)) {
      const lockFile = path.join(sessionDir, 'SingletonLock');
      if (fs.existsSync(lockFile)) {
        // Lock file stale significa que otro proceso lo dejo colgado
        try {
          fs.unlinkSync(lockFile);
          console.log('[OPENWA] SingletonLock stale eliminado');
        } catch (err) {}
      }
    }
  } catch (e) {
    console.error('[OPENWA] Error en cleanupOrphanSessions:', e.message);
  }
}
cleanupOrphanSessions();

const port = 3002;
const BACKEND_PORT = process.env.PORT || 18234;
let currentQR = null;
let clientStatus = 'starting';

// Buscar Chrome (delegado a chromeFinder compartido)
const { findChrome } = require('./chromeFinder');
function getChromePath() {
  return findChrome();
}

const chromePath = getChromePath();
console.log('[OPENWA] Chrome path:', chromePath || 'no encontrado');

const clientConfig = {
  authStrategy: new LocalAuth({ dataPath: authPath }),

  // ANTI-BAN: User-Agent real de Chrome 146 en Windows (NO macOS Chrome 101)
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',

  // ANTI-BAN: Identificar dispositivo vinculado
  deviceName: 'Vita Mirabilis',
  browserName: 'Chrome',

  // Anti-bloqueo: limitar reintentos QR
  authTimeoutMs: 60000,
  qrMaxRetries: 5,

  // Anti-bloqueo: tomar sesión si hay conflicto
  takeoverOnConflict: true,
  takeoverTimeoutMs: 60000,

  puppeteer: {
    headless: true,
    protocolTimeout: 120000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-extensions',
      // ANTI-BAN: Stealth flags
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  },
};
if (chromePath) clientConfig.puppeteer.executablePath = chromePath;

// Hook para capturar errores de la pagina de WhatsApp Web
clientConfig.puppeteer.headless = true;

let initAttempts = 0;
const MAX_INIT_ATTEMPTS = 5;
function startClient() {
  initAttempts++;
  if (initAttempts > MAX_INIT_ATTEMPTS) {
    console.error('[OPENWA] Demasiados intentos, reseteando...');
    initAttempts = 0;
  }
  console.log('[OPENWA] Inicializando cliente (intento', initAttempts, ')...');
  client.initialize().catch(err => {
    console.error('[OPENWA] Initialize error:', err.message);
    clientStatus = 'auth_failure';
    // Destruir cliente, matar Chrome, limpiar auth y reintentar
    try { client.destroy().catch(() => {}); } catch (e) {}
    setTimeout(() => {
      killChromeProcesses();
      try {
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
          fs.mkdirSync(authPath, { recursive: true });
          console.log('[OPENWA] Auth limpiado, reintentando...');
        }
      } catch (e) {}
      clientStatus = 'starting';
      startClient();
    }, 5000);
  });
}

const client = new Client(clientConfig);

client.on('qr', (qr) => {
  console.log('[OPENWA] QR received');
  clientStatus = 'qr';
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) currentQR = url;
  });
});

client.on('authenticated', () => {
  console.log('[OPENWA] Authenticated');
  clientStatus = 'authenticated';
});

client.on('auth_attempt', (data) => {
  console.log('[OPENWA] auth_attempt event:', JSON.stringify(data));
});

// Catch events from the client for debugging (filtered - no noise)
const WA_NOISE_EVENTS = new Set([
  'unread_count', 'contact_changed', 'message_ciphertext', 'message_edit',
  'message_reaction', 'group_metadata', 'chat_removed',
]);
const origEmit = client.emit.bind(client);
client.emit = function(event, ...args) {
  if (!WA_NOISE_EVENTS.has(event)) {
    const preview = args[0] ? (typeof args[0] === 'object' ? JSON.stringify(args[0]).slice(0, 150) : String(args[0]).slice(0, 150)) : '';
    process.stderr.write('[OPENWA] ' + event + (preview ? ': ' + preview : '') + '\n');
  }
  return origEmit(event, ...args);
};

client.on('auth_failure', (msg) => {
  console.error('[OPENWA] Auth failure:', msg);
  clientStatus = 'auth_failure';
  currentQR = null;
  // Destruir cliente y limpiar sesion corrupta
  try { client.destroy().catch(() => {}); } catch (e) {}
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('[OPENWA] Auth folder cleaned after failure');
      fs.mkdirSync(authPath, { recursive: true });
    }
  } catch (e) {
    console.error('[OPENWA] Error cleaning auth:', e.message);
  }
  // Reintentar despues de 3s
  setTimeout(() => {
    killChromeProcesses();
    console.log('[OPENWA] Reinitializing after auth_failure...');
    clientStatus = 'starting';
    startClient();
  }, 3000);
});

client.on('ready', () => {
  console.log('[OPENWA] WhatsApp client ready!');
  clientStatus = 'ready';
  currentQR = null;

  // ANTI-BAN: Inyectar stealth en la página de WhatsApp Web
  try {
    client.pupPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-PE', 'es', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });
  } catch (e) {}
});

client.on('disconnected', (reason) => {
  console.log('[OPENWA] Disconnected:', reason);
  clientStatus = 'disconnected';
  currentQR = null;
  // Destruir cliente y limpiar sesion
  try { client.destroy().catch(() => {}); } catch (e) {}
  try {
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      console.log('[OPENWA] Auth folder cleaned after disconnect');
      fs.mkdirSync(authPath, { recursive: true });
    }
  } catch (e) {}
  setTimeout(() => {
    killChromeProcesses();
    console.log('[OPENWA] Reinitializing after disconnect...');
    clientStatus = 'starting';
    startClient();
  }, 5000);
});

client.on('message_ack', (msg, ack) => {
  if (msg.id && msg.id.id) {
    const data = JSON.stringify({ messageId: msg.id.id, ack: ack });
    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: '/api/whatsapp/ack',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, () => {});
    req.on('error', () => {});
    req.write(data);
    req.end();
  }
});

// Auto-ingest: escuchar mensajes entrantes con imagenes (solo chats privados)
client.on('message', async (msg) => {
  try {
    if (!msg.hasMedia) return;
    const mediaType = msg.type;
    if (mediaType !== 'image') return;
    if (msg.fromMe) return;

    const from = msg.from || '';
    if (from.endsWith('@g.us')) return;

    const phone = from.replace('@c.us', '');
    if (!phone || !/^\d{8,15}$/.test(phone)) return;

    console.log('[OPENWA] Imagen recibida de:', phone);

    const media = await msg.downloadMedia();
    if (!media || !media.data) {
      console.log('[OPENWA] No se pudo descargar media de:', phone);
      return;
    }

    const caption = msg.body || '';
    const payload = JSON.stringify({
      phone,
      base64: `data:${media.mimetype};base64,${media.data}`,
      filename: media.filename || `whatsapp_${Date.now()}.jpg`,
      mimetype: media.mimetype,
      caption,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      chatId: msg.chat?.id?.serialized || '',
    });

    const req = http.request({
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: '/api/whatsapp/ingest-image',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('[OPENWA] Imagen ingestada OK:', phone);
        } else {
          console.log('[OPENWA] ingest-image response:', res.statusCode, body.substring(0, 200));
        }
      });
    });
    req.on('error', (err) => {
      console.error('[OPENWA] ingest-image error:', err.message);
    });
    req.write(payload);
    req.end();
  } catch (err) {
    console.error('[OPENWA] Error procesando mensaje entrante:', err.message);
  }
});

function parsePhone(phone) {
  let p = String(phone).replace(/[^0-9]/g, '');
  if (p.length > 10 && !p.startsWith('51')) p = '51' + p.slice(-9);
  return p + '@c.us';
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:18234');

  if (req.url === '/api/getStatus') {
    return res.end(JSON.stringify({
      connected: clientStatus === 'ready',
      status: clientStatus,
    }));
  }

  if (req.url === '/api/getQR') {
    return res.end(JSON.stringify({ qr: currentQR }));
  }

  if (req.url === '/api/logout' && req.method === 'POST') {
    try {
      await client.logout();
      clientStatus = 'disconnected';
      currentQR = null;
      try {
        if (fs.existsSync(authPath)) {
          fs.rmSync(authPath, { recursive: true, force: true });
          fs.mkdirSync(authPath, { recursive: true });
        }
      } catch (e) {}
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.url === '/api/restart' && req.method === 'POST') {
    try {
      clientStatus = 'starting';
      currentQR = null;
      try { await client.destroy(); } catch (e) {}
      setTimeout(() => {
        startClient();
      }, 3000);
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.url === '/api/sendText' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        if (clientStatus !== 'ready') {
          res.statusCode = 503;
          res.end(JSON.stringify({ success: false, message: 'WhatsApp no esta listo (status: ' + clientStatus + ')' }));
          return;
        }
        const data = JSON.parse(body);
        const chatId = parsePhone(data.phone);
        console.log('[OPENWA] Sending to:', chatId, 'msg:', (data.message || '').substring(0, 50));
        const result = await client.sendMessage(chatId, data.message);
        console.log('[OPENWA] Message sent OK, id:', result.id);
        res.end(JSON.stringify({ success: true, id: result.id }));
      } catch (err) {
        console.error('[OPENWA] sendText error:', err.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  if (req.url === '/api/sendImage' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const chatId = parsePhone(data.phone);
        const { MessageMedia } = require(wwjsPath);
        let media;
        if (data.base64) {
          const base64Data = data.base64.replace(/^data:image\/\w+;base64,/, '');
          media = new MessageMedia('image/png', base64Data);
        }
        const opts = data.caption ? { caption: data.caption } : {};
        const result = await client.sendMessage(chatId, media, opts);
        res.end(JSON.stringify({ success: true, id: result.id }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  if (req.url === '/api/sendDocument' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const chatId = parsePhone(data.phone);
        const { MessageMedia } = require(wwjsPath);
        let media;
        if (data.base64) {
          const base64Data = data.base64.replace(/^data:[^;]+;base64,/, '');
          media = new MessageMedia(data.mimetype || 'application/pdf', base64Data, data.filename || 'documento.pdf');
        }
        const result = await client.sendMessage(chatId, media, { sendMediaAsDocument: true, caption: data.caption });
        res.end(JSON.stringify({ success: true, id: result.id }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  if (req.url === '/api/sendFile' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const chatId = parsePhone(data.phone);
        const { MessageMedia } = require(wwjsPath);
        const media = await MessageMedia.fromFilePath(data.filePath);
        const result = await client.sendMessage(chatId, media, { sendMediaAsDocument: true, caption: data.caption });
        res.end(JSON.stringify({ success: true, id: result.id }));
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
  console.log(`[OPENWA] OpenWA-compatible API listening on port ${port}`);
});

function killChromeProcesses() {
  try {
    const { execSync } = require('child_process');
    // Matar todos los Chrome.exe (los lanza Puppeteer)
    execSync('taskkill /F /IM chrome.exe /T 2>nul', { stdio: 'ignore' });
    console.log('[OPENWA] Chrome processes killed');
  } catch (e) {}
}

// Llamada inicial - toda la logica de retry esta en startClient()
startClient();
