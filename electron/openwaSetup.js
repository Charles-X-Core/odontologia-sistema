const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const OPENWA_URL = process.env.OPENWA_URL || 'http://localhost:3002';
const OPENWA_PORT = 3002;
let openwaProcess = null;

function cleanOldSessions() {
  // NO borrar sesiones - queremos que persistan
  // Solo limpiar cache obsoleto si existe
  const projectRoot = path.join(__dirname, '..');
  const cachePath = path.join(projectRoot, 'wwebjs_cache');
  try {
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true, force: true });
    }
  } catch (e) {}
}

function getChromePath() {
  const homeCache = path.join(process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(homeCache)) {
    const versions = fs.readdirSync(homeCache);
    for (const v of versions) {
      if (v.startsWith('win64-131')) {
        const chrome = path.join(homeCache, v, 'chrome-win64', 'chrome.exe');
        if (fs.existsSync(chrome)) return chrome;
      }
    }
    const sorted = versions.sort().reverse();
    for (const v of sorted) {
      const chrome = path.join(homeCache, v, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(chrome)) return chrome;
    }
  }
  return null;
}

function createWWebJSRunner() {
  const projectRoot = path.join(__dirname, '..');
  const scriptPath = path.join(projectRoot, 'openwa-runner.js');
  const chromePath = getChromePath();
  const port = OPENWA_PORT;

  const script = [
    "const { Client, LocalAuth } = require('whatsapp-web.js');",
    "const http = require('http');",
    "const qrcode = require('qrcode');",
    "const port = " + port + ";",
    "",
    "let currentQR = null;",
    "let clientStatus = 'starting';",
    "let waClient = null;",
    "",
    "const client = new Client({",
    "  authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),",
    "  puppeteer: {",
    "    headless: true,",
    (chromePath ? "    executablePath: '" + chromePath.replace(/\\/g, '\\\\') + "'," : ""),
    "    args: [",
    "      '--no-sandbox',",
    "      '--disable-setuid-sandbox',",
    "      '--disable-dev-shm-usage',",
    "      '--disable-accelerated-2d-canvas',",
    "      '--no-first-run',",
    "      '--disable-gpu',",
    "      '--disable-extensions',",
    "    ],",
    "  },",
    "});",
    "",
    "client.on('qr', (qr) => {",
    "  console.log('QR received');",
    "  qrcode.toDataURL(qr, (err, url) => {",
    "    if (!err) currentQR = url;",
    "  });",
    "  clientStatus = 'qr';",
    "});",
    "",
    "client.on('ready', () => {",
    "  console.log('WhatsApp client ready!');",
    "  clientStatus = 'ready';",
    "  currentQR = null;",
    "});",
    "",
    "client.on('authenticated', () => {",
    "  console.log('Authenticated');",
    "  clientStatus = 'authenticated';",
    "});",
    "",
    "client.on('auth_failure', (msg) => {",
    "  console.error('Auth failure:', msg);",
    "  clientStatus = 'auth_failure';",
    "  // Auto-restart after auth failure",
    "  setTimeout(() => {",
    "    console.log('Restarting after auth failure...');",
    "    client.initialize().catch(e => console.error('Restart failed:', e.message));",
    "  }, 3000);",
    "});",
    "",
    "client.on('disconnected', (reason) => {",
    "  console.log('Disconnected:', reason);",
    "  clientStatus = 'disconnected';",
    "  // Auto-reconnect after 5 seconds",
    "  setTimeout(() => {",
    "    if (clientStatus === 'disconnected') {",
    "      console.log('Attempting reconnect...');",
    "      client.initialize().catch(e => console.error('Reconnect failed:', e.message));",
    "    }",
    "  }, 5000);",
    "});",
    "",
    "client.on('message_ack', (msg, ack) => {",
    "  if (msg.id && msg.id.id) {",
    "    const http2 = require('http');",
    "    const data = JSON.stringify({ messageId: msg.id.id, ack: ack });",
    "    const req = http2.request({",
    "      hostname: 'localhost',",
    "      port: 3001,",
    "      path: '/api/whatsapp/ack',",
    "      method: 'POST',",
    "      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },",
    "    }, () => {});",
    "    req.on('error', () => {});",
    "    req.write(data);",
    "    req.end();",
    "    console.log('ACK update sent: ' + msg.id.id + ' ack=' + ack);",
    "  }",
    "});",
    "",
    "function parsePhone(phone) {",
    "  let p = phone.replace(/[^0-9]/g, '');",
    "  if (p.length > 10 && !p.startsWith('51')) {",
    "    p = '51' + p.slice(-9);",
    "  }",
    "  return p + '@c.us';",
    "}",
    "",
    "const server = http.createServer(async (req, res) => {",
    "  res.setHeader('Content-Type', 'application/json');",
    "",
    "  if (req.url === '/api/getStatus') {",
    "    return res.end(JSON.stringify({",
    "      connected: clientStatus === 'ready',",
    "      status: clientStatus,",
    "    }));",
    "  }",
    "",
    "  if (req.url === '/api/logout' && req.method === 'POST') {",
    "    try {",
    "      await client.logout();",
    "      clientStatus = 'disconnected';",
    "      res.end(JSON.stringify({ success: true }));",
    "    } catch (err) {",
    "      res.statusCode = 500;",
    "      res.end(JSON.stringify({ success: false, message: err.message }));",
    "    }",
    "    return;",
    "  }",
    "",
    "  if (req.url === '/api/restart' && req.method === 'POST') {",
    "    try {",
    "      clientStatus = 'starting';",
    "      client.destroy().catch(() => {});",
    "      setTimeout(() => {",
    "        client.initialize().catch(e => console.error('Restart failed:', e.message));",
    "      }, 2000);",
    "      res.end(JSON.stringify({ success: true }));",
    "    } catch (err) {",
    "      res.statusCode = 500;",
    "      res.end(JSON.stringify({ success: false, message: err.message }));",
    "    }",
    "    return;",
    "  }",
    "",
    "  if (req.url === '/api/getQR') {",
    "    return res.end(JSON.stringify({ qr: currentQR }));",
    "  }",
    "",
    "  if (req.url === '/api/sendText' && req.method === 'POST') {",
    "    let body = '';",
    "    req.on('data', c => body += c);",
    "    req.on('end', async () => {",
    "      try {",
    "        const data = JSON.parse(body);",
    "        const chatId = parsePhone(data.phone);",
    "        const result = await client.sendMessage(chatId, data.message);",
    "        res.end(JSON.stringify({ success: true, id: result.id }));",
    "      } catch (err) {",
    "        res.statusCode = 500;",
    "        res.end(JSON.stringify({ success: false, message: err.message }));",
    "      }",
    "    });",
    "    return;",
    "  }",
    "",
    "  if (req.url === '/api/sendImage' && req.method === 'POST') {",
    "    let body = '';",
    "    req.on('data', c => body += c);",
    "    req.on('end', async () => {",
    "      try {",
    "        const data = JSON.parse(body);",
    "        const chatId = parsePhone(data.phone);",
    "        const { MessageMedia } = require('whatsapp-web.js');",
    "        let media;",
    "        if (data.base64) {",
    "          const base64Data = data.base64.replace(/^data:image\\/\\w+;base64,/, '');",
    "          media = new MessageMedia('image/png', base64Data);",
    "        }",
    "        const opts = data.caption ? { caption: data.caption } : {};",
    "        const result = await client.sendMessage(chatId, media, opts);",
    "        res.end(JSON.stringify({ success: true, id: result.id }));",
    "      } catch (err) {",
    "        res.statusCode = 500;",
    "        res.end(JSON.stringify({ success: false, message: err.message }));",
    "      }",
    "    });",
    "    return;",
    "  }",
    "",
    "  if (req.url === '/api/sendDocument' && req.method === 'POST') {",
    "    let body = '';",
    "    req.on('data', c => body += c);",
    "    req.on('end', async () => {",
    "      try {",
    "        const data = JSON.parse(body);",
    "        const chatId = parsePhone(data.phone);",
    "        const { MessageMedia } = require('whatsapp-web.js');",
    "        let media;",
    "        if (data.base64) {",
    "          const base64Data = data.base64.replace(/^data:[^;]+;base64,/, '');",
    "          media = new MessageMedia(data.mimetype || 'application/pdf', base64Data, data.filename || 'documento.pdf');",
    "        }",
    "        const opts = { sendMediaAsDocument: true };",
    "        if (data.caption) opts.caption = data.caption;",
    "        const result = await client.sendMessage(chatId, media, opts);",
    "        res.end(JSON.stringify({ success: true, id: result.id }));",
    "      } catch (err) {",
    "        res.statusCode = 500;",
    "        res.end(JSON.stringify({ success: false, message: err.message }));",
    "      }",
    "    });",
    "    return;",
    "  }",
    "",
    "  if (req.url === '/api/sendFile' && req.method === 'POST') {",
    "    let body = '';",
    "    req.on('data', c => body += c);",
    "    req.on('end', async () => {",
    "      try {",
    "        const data = JSON.parse(body);",
    "        const chatId = parsePhone(data.phone);",
    "        const { MessageMedia } = require('whatsapp-web.js');",
    "        const media = await MessageMedia.fromFilePath(data.filePath);",
    "        const opts = { sendMediaAsDocument: true };",
    "        if (data.caption) opts.caption = data.caption;",
    "        const result = await client.sendMessage(chatId, media, opts);",
    "        res.end(JSON.stringify({ success: true, id: result.id }));",
    "      } catch (err) {",
    "        res.statusCode = 500;",
    "        res.end(JSON.stringify({ success: false, message: err.message }));",
    "      }",
    "    });",
    "    return;",
    "  }",
    "",
    "  res.statusCode = 404;",
    "  res.end(JSON.stringify({ error: 'Not found' }));",
    "});",
    "",
    "server.listen(port, () => {",
    "  console.log('OpenWA-compatible API listening on port ' + port);",
    "});",
    "",
    "client.initialize().catch(err => {",
    "  console.error('Failed to initialize:', err.message);",
    "  process.exit(1);",
    "});",
  ].join('\n');

  fs.writeFileSync(scriptPath, script, 'utf-8');
  return scriptPath;
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

function startOpenWA(onProgress) {
  return new Promise(function(resolve, reject) {
    if (openwaProcess) {
      checkOpenWA().then(function(s) { if (s.running) return resolve({ success: true }); });
    }

    if (onProgress) onProgress({ phase: 'starting', message: 'Iniciando WhatsApp Web...' });

    cleanOldSessions();

    const scriptPath = createWWebJSRunner();
    const nodeBin = process.execPath;

    const child = spawn(nodeBin, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
      cwd: path.join(__dirname, '..'),
    });

    openwaProcess = child;
    var started = false;
    var output = '';

    child.stdout.on('data', function(d) {
      try {
        var text = d.toString();
        output += text;
        if (!started && text.indexOf('listening on port') !== -1) {
          started = true;
          resolve({ success: true });
        }
      } catch (e) {}
    });

    child.stderr.on('data', function(d) {
      try { output += d.toString(); } catch (e) {}
    });

    child.on('close', function(code) {
      openwaProcess = null;
      if (!started) {
        reject(new Error('WhatsApp termino con codigo ' + code + ': ' + output.slice(-500)));
      }
    });

    child.on('error', function(err) {
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
  var start = Date.now();
  while (Date.now() - start < maxWait) {
    var status = await checkOpenWA();
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
