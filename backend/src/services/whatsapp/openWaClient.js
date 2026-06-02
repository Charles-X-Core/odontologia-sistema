const OPENWA_URL = process.env.OPENWA_URL || 'http://localhost:3002';

async function sendText(phone, message) {
  const response = await fetch(`${OPENWA_URL}/api/sendText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message, checkNumber: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `OpenWA error: ${response.status}`);
  }

  return response.json();
}

async function sendImage(phone, imageBase64, caption) {
  const response = await fetch(`${OPENWA_URL}/api/sendImage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, base64: imageBase64, caption, checkNumber: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `OpenWA error: ${response.status}`);
  }

  return response.json();
}

async function getStatus() {
  try {
    const response = await fetch(`${OPENWA_URL}/api/getStatus`);
    if (!response.ok) return { connected: false, error: 'Server unreachable' };
    const data = await response.json();
    return { connected: data.connected || false, info: data };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

async function getQR() {
  try {
    const response = await fetch(`${OPENWA_URL}/api/getQR`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.qr || null;
  } catch {
    return null;
  }
}

async function sendDocument(phone, documentBase64, filename, caption) {
  const response = await fetch(`${OPENWA_URL}/api/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, base64: documentBase64, filename, caption, mimetype: 'application/pdf', checkNumber: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `OpenWA error: ${response.status}`);
  }

  return response.json();
}

async function sendFile(phone, filePath, filename, caption) {
  const response = await fetch(`${OPENWA_URL}/api/sendFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, filePath, filename, caption, checkNumber: true }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `OpenWA error: ${response.status}`);
  }

  return response.json();
}

async function logout() {
  const response = await fetch(`${OPENWA_URL}/api/logout`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to logout');
  return response.json();
}

async function restart() {
  const response = await fetch(`${OPENWA_URL}/api/restart`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to restart');
  return response.json();
}

module.exports = { sendText, sendImage, sendDocument, sendFile, getStatus, getQR, logout, restart };
