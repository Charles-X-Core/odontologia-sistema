const puppeteer = require('puppeteer-core');
const { findChrome } = require('../../../utils/chromeFinder');

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
