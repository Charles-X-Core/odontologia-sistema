const ds = require('./dockerSetup');

async function debug() {
  console.log('=== DEBUG DOCKER STATUS ===\n');

  // 1. Docker Desktop instalado?
  console.log('1. Docker Desktop instalado:');
  const installed = ds.checkDockerInstalled();
  console.log('  ', JSON.stringify(installed));

  // 2. Docker CLI disponible?
  console.log('\n2. Docker CLI:');
  const cli = ds.checkDockerCLI();
  console.log('  ', JSON.stringify(cli));

  // 3. Docker daemon corriendo?
  console.log('\n3. Docker daemon:');
  const running = ds.checkDockerRunning();
  console.log('  running:', running);

  // 4. Procesos de Docker
  console.log('\n4. Procesos Docker:');
  const { execSync } = require('child_process');
  try {
    const procs = execSync('tasklist /FI "IMAGENAME eq Docker Desktop.exe" /FO CSV /NH', { encoding: 'utf-8' });
    console.log('  Docker Desktop:', procs.trim().split('\n').length, 'procesos');
  } catch { console.log('  Docker Desktop: no encontrado'); }

  try {
    const procs = execSync('tasklist /FI "IMAGENAME eq com.docker.backend.exe" /FO CSV /NH', { encoding: 'utf-8' });
    console.log('  Docker Backend:', procs.trim().split('\n').length, 'procesos');
  } catch { console.log('  Docker Backend: no encontrado'); }

  try {
    const procs = execSync('tasklist /FI "IMAGENAME eq dockerd.exe" /FO CSV /NH', { encoding: 'utf-8' });
    console.log('  DockerD:', procs.trim().split('\n').length, 'procesos');
  } catch { console.log('  DockerD: no encontrado'); }

  // 5. Docker info (con timeout)
  console.log('\n5. Docker info:');
  try {
    const info = execSync('docker info --format "{{.ServerVersion}}"', { encoding: 'utf-8', timeout: 5000 });
    console.log('  OK, version:', info.trim());
  } catch (e) {
    console.log('  FALLA:', e.message.substring(0, 200));
  }

  // 6. Intentar iniciar Docker Desktop
  console.log('\n6. Intentando abrir Docker Desktop...');
  const dockerPath = installed.path;
  if (dockerPath) {
    try {
      const { spawn } = require('child_process');
      const child = spawn(dockerPath, [], { detached: true, stdio: 'ignore' });
      child.unref();
      console.log('  Docker Desktop abierto (PID:', child.pid, ')');
    } catch (e) {
      console.log('  Error al abrir:', e.message);
    }
  }

  // 7. Esperar 10 segundos y re-verificar
  console.log('\n7. Esperando 10 segundos...');
  await new Promise(r => setTimeout(r, 10000));

  console.log('\n8. Verificacion despues de 10s:');
  const runningAfter = ds.checkDockerRunning();
  console.log('  Docker daemon:', runningAfter ? 'CORRIENDO' : 'NO CORRIENDO');

  if (runningAfter) {
    const cliAfter = ds.checkDockerCLI();
    console.log('  Docker CLI:', cliAfter.available ? cliAfter.version : 'NO DISPONIBLE');
  }

  // 8. OpenWA
  console.log('\n9. OpenWA:');
  const openwa = await ds.checkOpenWA();
  console.log('  ', JSON.stringify(openwa));

  console.log('\n=== FIN DEBUG ===');
}

debug().catch(console.error);
