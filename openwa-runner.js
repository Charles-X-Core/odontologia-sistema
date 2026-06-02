const { Client, LocalAuth } = require('whatsapp-web.js');
const http = require('http');
const qrcode = require('qrcode');
const port = 3002;

let currentQR = null;
let clientStatus = 'starting';
let waClient = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
  puppeteer: {
    headless: true,
    executablePath: 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--disable-gpu',
      '--disable-extensions',
    ],
  },
});

client.on('qr', (qr) => {
  console.log('QR received');
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) currentQR = url;
  });
  clientStatus = 'qr';
});

client.on('ready', () => {
  console.log('WhatsApp client ready!');
  clientStatus = 'ready';
  currentQR = null;
});

client.on('authenticated', () => {
  console.log('Authenticated');
  clientStatus = 'authenticated';
});

client.on('auth_failure', (msg) => {
  console.error('Auth failure:', msg);
  clientStatus = 'auth_failure';
  // Auto-restart after auth failure
  setTimeout(() => {
    console.log('Restarting after auth failure...');
    client.initialize().catch(e => console.error('Restart failed:', e.message));
  }, 3000);
});

client.on('disconnected', (reason) => {
  console.log('Disconnected:', reason);
  clientStatus = 'disconnected';
  // Auto-reconnect after 5 seconds
  setTimeout(() => {
    if (clientStatus === 'disconnected') {
      console.log('Attempting reconnect...');
      client.initialize().catch(e => console.error('Reconnect failed:', e.message));
    }
  }, 5000);
});

client.on('message_ack', (msg, ack) => {
  if (msg.id && msg.id.id) {
    const http2 = require('http');
    const data = JSON.stringify({ messageId: msg.id.id, ack: ack });
    const req = http2.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/whatsapp/ack',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, () => {});
    req.on('error', () => {});
    req.write(data);
    req.end();
    console.log('ACK update sent: ' + msg.id.id + ' ack=' + ack);
  }
});

function parsePhone(phone) {
  let p = phone.replace(/[^0-9]/g, '');
  if (p.length > 10 && !p.startsWith('51')) {
    p = '51' + p.slice(-9);
  }
  return p + '@c.us';
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/getStatus') {
    return res.end(JSON.stringify({
      connected: clientStatus === 'ready',
      status: clientStatus,
    }));
  }

  if (req.url === '/api/logout' && req.method === 'POST') {
    try {
      await client.logout();
      clientStatus = 'disconnected';
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
      client.destroy().catch(() => {});
      setTimeout(() => {
        client.initialize().catch(e => console.error('Restart failed:', e.message));
      }, 2000);
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  if (req.url === '/api/getQR') {
    return res.end(JSON.stringify({ qr: currentQR }));
  }

  if (req.url === '/api/sendText' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const chatId = parsePhone(data.phone);
        const result = await client.sendMessage(chatId, data.message);
        res.end(JSON.stringify({ success: true, id: result.id }));
      } catch (err) {
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
        const { MessageMedia } = require('whatsapp-web.js');
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
        const { MessageMedia } = require('whatsapp-web.js');
        let media;
        if (data.base64) {
          const base64Data = data.base64.replace(/^data:[^;]+;base64,/, '');
          media = new MessageMedia(data.mimetype || 'application/pdf', base64Data, data.filename || 'documento.pdf');
        }
        const opts = { sendMediaAsDocument: true };
        if (data.caption) opts.caption = data.caption;
        const result = await client.sendMessage(chatId, media, opts);
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
        const { MessageMedia } = require('whatsapp-web.js');
        const media = await MessageMedia.fromFilePath(data.filePath);
        const opts = { sendMediaAsDocument: true };
        if (data.caption) opts.caption = data.caption;
        const result = await client.sendMessage(chatId, media, opts);
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
  console.log('OpenWA-compatible API listening on port ' + port);
});

client.initialize().catch(err => {
  console.error('Failed to initialize:', err.message);
  process.exit(1);
});