const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

async function sendMessage(to, message) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('WhatsApp no configurado. Define WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en .env');
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function sendTemplate(to, templateName, languageCode, parameters) {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    throw new Error('WhatsApp no configurado');
  }

  const template = {
    name: templateName,
    language: { code: languageCode || 'es' },
  };

  if (parameters && parameters.length > 0) {
    template.components = [{ type: 'body', parameters: parameters.map(p => ({ type: 'text', text: String(p) })) }];
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template,
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function getStatus() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { connected: false, configured: false, error: 'WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN no configurados' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}`,
      { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } }
    );
    const data = await response.json();
    if (data.error) return { connected: false, configured: true, error: data.error.message };
    return { connected: true, configured: true, phone: data.display_phone_number, quality: data.quality_rating };
  } catch (err) {
    return { connected: false, configured: true, error: err.message };
  }
}

function formatPhone(phone) {
  let clean = phone.replace(/[^0-9]/g, '');
  if (!clean.startsWith('51')) clean = '51' + clean;
  return clean;
}

module.exports = { sendMessage, sendTemplate, getStatus, formatPhone };
