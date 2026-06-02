const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

const OPENWA_URL = 'http://localhost:3002';
const DOCKER_COMPOSE_PATH = path.join(__dirname, '..', 'docker-compose.yml');

const DOCKER_EXE_PATHS = [
  'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
  'C:\\Program Files\\Docker\\Docker\\docker.exe',
  path.join(process.env.ProgramFiles || '', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
];

const DOCKER_DESKTOP_PATHS = [
  'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
  'C:\\Program Files (x86)\\Docker\\Docker\\Docker Desktop.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Docker', 'Docker', 'Docker Desktop.exe'),
];

function findDockerExe() {
  for (const p of DOCKER_EXE_PATHS) { if (fs.existsSync(p)) return p; }
  return null;
}

function ensureDockerInPath() {
  const exePath = findDockerExe();
  if (exePath) {
    const binDir = path.dirname(exePath);
    if (!process.env.PATH.includes(binDir)) {
      process.env.PATH = binDir + ';' + process.env.PATH;
    }
  }
}

function runDockerCmd(args) {
  try { return execSync(`docker ${args}`, { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 }); } catch {}
  const exe = findDockerExe();
  if (exe) {
    try { return execSync(`"${exe}" ${args}`, { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 }); } catch {}
  }
  return null;
}

// Verificar si WSL 2 está habilitado correctamente
function checkWSL2() {
  try {
    const result = execSync('wsl --version', { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
    if (result.includes('2.') && !result.includes('not recognized')) {
      return { enabled: true, version: 2 };
    }
    return { enabled: false };
  } catch {
    return { enabled: false };
  }
}

// Habilitar WSL 2 automáticamente
function enableWSL2() {
  const wsl = checkWSL2();
  if (wsl.enabled) return { success: true, needsRestart: false };

  try {
    execSync('dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart', {
      stdio: 'pipe', timeout: 120000,
    });
    execSync('dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart', {
      stdio: 'pipe', timeout: 120000,
    });
    try { execSync('wsl --set-default-version 2', { stdio: 'pipe', timeout: 30000 }); } catch {}
    return { success: true, needsRestart: true };
  } catch (err) {
    // Si falla, intentar con elevation via PowerShell
    try {
      const psCmd = `Start-Process -FilePath "dism.exe" -ArgumentList '/online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart' -Verb RunAs -Wait; Start-Process -FilePath "dism.exe" -ArgumentList '/online /enable-feature /featurename:VirtualMachinePlatform /all /norestart' -Verb RunAs -Wait`;
      execSync(`powershell -Command "${psCmd}"`, { stdio: 'pipe', timeout: 180000 });
      try { execSync('wsl --set-default-version 2', { stdio: 'pipe', timeout: 30000 }); } catch {}
      return { success: true, needsRestart: true };
    } catch (err2) {
      // Si PowerShell elevation también falla
      return { success: false, error: err2.message, needsAdmin: true };
    }
  }
}

function checkDockerInstalled() {
  for (const p of DOCKER_DESKTOP_PATHS) { if (fs.existsSync(p)) return { installed: true, path: p }; }
  return { installed: false, path: null };
}

function launchDockerDesktop() {
  const installed = checkDockerInstalled();
  if (!installed.installed) return false;
  try {
    const { execSync } = require('child_process');
    execSync(`start "" "${installed.path}"`, { stdio: 'pipe', shell: true, timeout: 5000 });
    return true;
  } catch {
    try {
      const { spawn } = require('child_process');
      spawn(installed.path, [], { detached: true, stdio: 'ignore' }).unref();
      return true;
    } catch { return false; }
  }
}

function checkDockerCLI() {
  try {
    const result = execSync('docker --version', { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
    return { available: true, version: result.trim() };
  } catch {}
  const exe = findDockerExe();
  if (exe) {
    try {
      const result = execSync(`"${exe}" --version`, { encoding: 'utf-8', stdio: 'pipe', timeout: 10000 });
      return { available: true, version: result.trim() };
    } catch {}
  }
  return { available: false, version: null };
}

function checkDockerRunning() {
  const result = runDockerCmd('info');
  if (result !== null) return true;
  try {
    const { execSync } = require('child_process');
    const procs = execSync('tasklist /FI "IMAGENAME eq com.docker.backend.exe" /FO CSV /NH', { encoding: 'utf-8', timeout: 5000 });
    return procs.includes('com.docker.backend');
  } catch {}
  return false;
}

function checkOpenWA() {
  return new Promise((resolve) => {
    const req = http.get(`${OPENWA_URL}/api/getStatus`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { const json = JSON.parse(data); resolve({ running: true, connected: json.connected || false, info: json }); }
        catch { resolve({ running: false, connected: false }); }
      });
    });
    req.on('error', () => resolve({ running: false, connected: false }));
    req.on('timeout', () => { req.destroy(); resolve({ running: false, connected: false }); });
  });
}

async function waitForDocker(maxWait = 300000, interval = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (checkDockerRunning()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

async function waitForOpenWA(maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const status = await checkOpenWA();
    if (status.running) return true;
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

function startOpenWA() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DOCKER_COMPOSE_PATH)) return reject(new Error('docker-compose.yml no encontrado'));
    const env = { ...process.env, COMPOSE_PROJECT_NAME: 'vita-mirabilis' };
    const child = spawn('docker-compose', ['-f', DOCKER_COMPOSE_PATH, 'up', '-d', 'openwa'], {
      env, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', (code) => {
      if (code === 0) resolve({ success: true, output: stdout });
      else reject(new Error(stderr || `Exit code: ${code}`));
    });
    child.on('error', reject);
  });
}

function stopOpenWA() {
  return new Promise((resolve) => {
    const env = { ...process.env, COMPOSE_PROJECT_NAME: 'vita-mirabilis' };
    const child = spawn('docker-compose', ['-f', DOCKER_COMPOSE_PATH, 'down'], { env, stdio: 'pipe' });
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}

function pullImage() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const env = { ...process.env, DOCKER_API_VERSION: '1.44' };
      const child = spawn('docker', ['pull', 'openwa/wa-automate:latest'], {
        stdio: ['pipe', 'pipe', 'pipe'], env,
      });
      let output = '';
      child.stdout.on('data', d => output += d.toString());
      child.stderr.on('data', d => output += d.toString());
      child.on('close', (code) => { if (code === 0) resolve({ success: true }); else reject(new Error(output)); });
      child.on('error', reject);
    }, 5000);
  });
}

async function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    protocol.get(url, { timeout: 300000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close(); fs.unlinkSync(destPath);
        return downloadFile(response.headers.location, destPath, onProgress).then(resolve).catch(reject);
      }
      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes) onProgress({ loaded: downloadedBytes, total: totalBytes, percent: Math.round((downloadedBytes / totalBytes) * 100) });
      });
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve({ success: true, size: downloadedBytes }); });
    }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

async function installDocker(onProgress) {
  const installerPath = path.join(process.env.TEMP || '/tmp', 'DockerDesktopInstaller.exe');
  if (!fs.existsSync(installerPath)) {
    if (onProgress) onProgress({ phase: 'downloading', percent: 0 });
    await downloadFile('https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe', installerPath, (p) => {
      if (onProgress) onProgress({ phase: 'downloading', percent: p.percent });
    });
  }
  if (onProgress) onProgress({ phase: 'installing', percent: 0 });
  return new Promise((resolve, reject) => {
    const child = spawn(`"${installerPath}"`, ['install', '--quiet', '--accept-license', '--backend=wsl-2'], {
      shell: true, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', (code) => {
      if (code === 0) { if (onProgress) onProgress({ phase: 'done', percent: 100 }); resolve({ success: true, needsRestart: false }); }
      else if (stderr.includes('reboot') || stderr.includes('restart')) resolve({ success: true, needsRestart: true });
      else reject(new Error(stderr || `Exit code: ${code}`));
    });
    child.on('error', reject);
  });
}

// Setup completo (automático)
async function setupOpenWA(onProgress) {
  ensureDockerInPath();

  // Paso 1: Verificar WSL 2
  if (onProgress) onProgress({ phase: 'checking', message: 'Verificando sistema...' });
  const wsl = checkWSL2();
  if (!wsl.enabled) {
    if (onProgress) onProgress({ phase: 'enabling-wsl', message: 'Habilitando WSL 2... Se necesita reiniciar.' });
    const wslResult = enableWSL2();
    if (wslResult.needsRestart) {
      if (onProgress) onProgress({ phase: 'needs-restart', message: 'WSL 2 habilitado. Se necesita reiniciar la computadora.' });
      return { needsRestart: true };
    }
    if (wslResult.needsAdmin) {
      if (onProgress) onProgress({ phase: 'needs-admin', message: 'Se necesitan permisos de administrador para habilitar WSL.' });
      return { needsAdmin: true };
    }
  }

  // Paso 2: Verificar Docker CLI
  let cli = checkDockerCLI();
  if (!cli.available) {
    const installed = checkDockerInstalled();
    if (!installed.installed) {
      if (onProgress) onProgress({ phase: 'docker-not-found', message: 'Docker no esta instalado' });
      return { needsDockerInstall: true };
    }
    // Docker instalado pero CLI no disponible → lanzar Docker Desktop y esperar
    if (onProgress) onProgress({ phase: 'docker-starting', message: 'Lanzando Docker Desktop...' });
    launchDockerDesktop();
    await new Promise(r => setTimeout(r, 10000)); // esperar 10s para que inicie
    const dockerReady = await waitForDocker(300000, 5000); // 5 minutos
    if (!dockerReady) {
      if (onProgress) onProgress({ phase: 'docker-not-running', message: 'Docker Desktop no responde. Abre Docker Desktop manualmente desde el menu Inicio.' });
      return { needsDockerStart: true };
    }
    cli = checkDockerCLI();
    if (!cli.available) {
      if (onProgress) onProgress({ phase: 'docker-not-running', message: 'Docker CLI no disponible. Reinicia la app.' });
      return { needsDockerStart: true };
    }
  }

  // Paso 3: Verificar Docker daemon
  if (!checkDockerRunning()) {
    if (onProgress) onProgress({ phase: 'docker-starting', message: 'Docker Desktop esta iniciando... (puede tardar hasta 5 minutos)' });
    launchDockerDesktop();
    await new Promise(r => setTimeout(r, 10000)); // esperar 10s para que inicie
    const dockerReady = await waitForDocker(300000, 5000); // 5 minutos
    if (!dockerReady) {
      if (onProgress) onProgress({ phase: 'docker-not-running', message: 'Docker Desktop no responde. Abre Docker Desktop manualmente desde el menu Inicio.' });
      return { needsDockerStart: true };
    }
  }

  // Paso 4: Pull imagen OpenWA (con reintentos)
  if (onProgress) onProgress({ phase: 'pulling', message: 'Descargando imagen OpenWA... (puede tardar varios minutos)' });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await pullImage();
      break;
    } catch (err) {
      if (attempt < 3) {
        if (onProgress) onProgress({ phase: 'pulling', message: `Reintentando descarga... (intento ${attempt + 1}/3)` });
        await new Promise(r => setTimeout(r, 10000));
      } else {
        if (onProgress) onProgress({ phase: 'pull-error', message: 'Error al descargar imagen: ' + err.message });
        return { error: err.message };
      }
    }
  }

  // Paso 5: Iniciar OpenWA
  if (onProgress) onProgress({ phase: 'starting', message: 'Iniciando WhatsApp...' });
  try { await startOpenWA(); } catch (err) {
    if (onProgress) onProgress({ phase: 'start-error', message: 'Error al iniciar: ' + err.message });
    return { error: err.message };
  }

  // Paso 6: Esperar OpenWA
  if (onProgress) onProgress({ phase: 'waiting', message: 'Esperando conexion...' });
  const ready = await waitForOpenWA(30000);
  if (ready) {
    if (onProgress) onProgress({ phase: 'ready', message: 'WhatsApp listo! Escanea el QR.' });
    return { success: true };
  } else {
    if (onProgress) onProgress({ phase: 'timeout', message: 'OpenWA no responde. Verifica Docker.' });
    return { error: 'Timeout esperando OpenWA' };
  }
}

module.exports = {
  checkDockerInstalled, checkDockerCLI, checkDockerRunning, checkWSL2, enableWSL2,
  checkOpenWA, startOpenWA, stopOpenWA, pullImage, installDocker, setupOpenWA,
  waitForDocker, waitForOpenWA, launchDockerDesktop, OPENWA_URL,
};
