const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

function findChrome() {
  const candidates = [
    path.join(process.env.USERPROFILE || '', '.cache', 'puppeteer', 'chrome'),
    path.join(process.env.LOCALAPPDATA || '', 'puppeteer', 'chrome'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  for (const base of candidates) {
    if (!fs.existsSync(base)) continue;
    const stat = fs.statSync(base);
    if (stat.isFile() && base.endsWith('chrome.exe')) return base;
    const versions = fs.readdirSync(base).filter(d => d.startsWith('win64-')).sort().reverse();
    for (const v of versions) {
      const exe = path.join(base, v, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return null;
}

async function htmlToPdf(htmlContent, options = {}) {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome not found for puppeteer');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 15000 });

    const pdfBuffer = await page.pdf({
      format: options.format || 'Letter',
      margin: options.margin || { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      printBackground: true,
      displayHeaderFooter: false,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { htmlToPdf };
