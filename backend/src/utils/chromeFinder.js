// chromeFinder.js - Buscador centralizado de Chrome en Windows
// Usado por: htmlToPdf.js, openwaSetup.js, openwa-runner.js
// Centraliza la logica para evitar 3 implementaciones duplicadas

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Busca chrome.exe en el sistema. Retorna la ruta completa o null.
// Prioridad: puppeteer cache > Program Files > LocalAppData > Chrome SxS
function findChrome() {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
  const programFiles = process.env.PROGRAMFILES || 'C:\\Program Files';
  const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const userProfile = process.env.USERPROFILE || '';

  // 1. Puppeteer cache (mas comun en entornos Electron)
  const puppeteerCache = path.join(userProfile, '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(puppeteerCache)) {
    const found = findInPuppeteerCache(puppeteerCache);
    if (found) return found;
  }

  // 2. Puppeteer cache alternativo (%LOCALAPPDATA%)
  const altCache = path.join(localAppData, 'puppeteer', 'chrome');
  if (fs.existsSync(altCache)) {
    const found = findInPuppeteerCache(altCache);
    if (found) return found;
  }

  // 3. Chrome instalado en Program Files (64-bit)
  const pf64 = path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe');
  if (fs.existsSync(pf64)) return pf64;

  // 4. Chrome instalado en Program Files (86)
  const pf86 = path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe');
  if (fs.existsSync(pf86)) return pf86;

  // 5. Chrome instalado por usuario (%LOCALAPPDATA%)
  const userChrome = path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe');
  if (fs.existsSync(userChrome)) return userChrome;

  // 6. Chrome Canary/Dev (SxS)
  const chromeSxs = path.join(localAppData, 'Google', 'Chrome SxS', 'Application', 'chrome.exe');
  if (fs.existsSync(chromeSxs)) return chromeSxs;

  return null;
}

// Busca chrome.exe dentro de un directorio de puppeteer cache
// Estructura: cache/win64-131.0.6778.204/chrome-win64/chrome.exe
// Chrome 149 tiene bugs con whatsapp-web.js, preferir 146 o 131
function findInPuppeteerCache(cacheDir) {
  try {
    const entries = fs.readdirSync(cacheDir);
    const win64 = entries.filter(d => d.startsWith('win64-'));
    const win32 = entries.filter(d => d.startsWith('win32-'));
    const all = [...win64, ...win32];

    // Tomar la version mas nueva disponible (win64 primero)
    const sorted = all.sort().reverse();

    for (const v of sorted) {
      const exe64 = path.join(cacheDir, v, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(exe64)) return exe64;

      const exe32 = path.join(cacheDir, v, 'chrome-win32', 'chrome.exe');
      if (fs.existsSync(exe32)) return exe32;
    }
  } catch (e) {
    // Si el directorio no existe o no se puede leer, ignorar
  }
  return null;
}

// Instala Chrome via winget (solo si no existe). Retorna true/false.
async function installChromeViaWinget() {
  try {
    console.log('[CHROME-FINDER] Instalando Chrome via winget...');
    execSync('winget install Google.Chrome --accept-package-agreements --accept-source-agreements --silent',
      { stdio: 'inherit', timeout: 300000 });
    console.log('[CHROME-FINDER] Chrome instalado via winget');
    return true;
  } catch (e) {
    console.error('[CHROME-FINDER] Error instalando Chrome via winget:', e.message);
    return false;
  }
}

// Verifica si un path de Chrome es valido y accesible
function isChromeValid(chromePath) {
  if (!chromePath) return false;
  try {
    return fs.existsSync(chromePath) && fs.statSync(chromePath).isFile();
  } catch (e) {
    return false;
  }
}

module.exports = { findChrome, findInPuppeteerCache, installChromeViaWinget, isChromeValid };
