import { contextBridge, ipcRenderer } from 'electron';

const fredApi = {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  getSecretStatus: () => ipcRenderer.invoke('secrets:status'),
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('secrets:saveKey', apiKey),
  loadApiKey: () => ipcRenderer.invoke('secrets:loadKey'),
  deleteApiKey: () => ipcRenderer.invoke('secrets:deleteKey'),
  generateFreeFluxImage: (prompt: string) => ipcRenderer.invoke('image:generateFreeFlux', prompt),
};

contextBridge.exposeInMainWorld('fredApi', fredApi);
