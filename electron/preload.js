const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  checkOpenWA: () => ipcRenderer.invoke('check-openwa'),
  startOpenWA: () => ipcRenderer.invoke('start-openwa'),
  stopOpenWA: () => ipcRenderer.invoke('stop-openwa'),
  setupWhatsApp: () => ipcRenderer.invoke('setup-whatsapp'),
  getQR: () => ipcRenderer.invoke('get-qr'),
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  onSetupProgress: (callback) => ipcRenderer.on('setup-progress', (event, data) => callback(data)),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
});
