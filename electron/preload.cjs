const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  openGdtBrowser: () => ipcRenderer.invoke('open-gdt-browser')
});
