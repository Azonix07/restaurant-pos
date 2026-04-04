const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printBill: (html) => ipcRenderer.invoke('print-bill', html),
  getServerURL: () => ipcRenderer.invoke('get-server-url'),
  platform: process.platform,
});
