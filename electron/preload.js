const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printBill: (html) => ipcRenderer.invoke('print-bill', html),
  getServerURL: () => ipcRenderer.invoke('get-server-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, data) => callback(data));
  },
  onStartupStatus: (callback) => {
    ipcRenderer.on('startup-status', (_event, data) => callback(data));
  },
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  getStartupState: () => ipcRenderer.invoke('get-startup-state'),
  platform: process.platform,
});
