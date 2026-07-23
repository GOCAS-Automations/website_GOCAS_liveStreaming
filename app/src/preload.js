// preload.js · Puente seguro entre el renderer y el proceso principal
// Expone window.gocas con envoltorios de ipcRenderer.invoke. contextIsolation
// está activo, así que el renderer solo ve estas funciones (nunca Node directo).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gocas', {
  // Info de la app: { version, port, platform }.
  info: () => ipcRenderer.invoke('app:info'),

  // Datos persistidos: { lives, watermarks (con url) }.
  store: () => ipcRenderer.invoke('store:get'),

  // Transmisiones.
  saveLive: (live) => ipcRenderer.invoke('live:save', live),
  deleteLive: (id) => ipcRenderer.invoke('live:delete', id),

  // Marcas de agua.
  addWatermark: () => ipcRenderer.invoke('wm:add'),
  renameWatermark: (id, name) => ipcRenderer.invoke('wm:rename', { id, name }),
  deleteWatermark: (id) => ipcRenderer.invoke('wm:delete', id),

  // Cámara y streaming.
  probe: (rtspUrl) => ipcRenderer.invoke('probe', rtspUrl),
  start: (id, mode) => ipcRenderer.invoke('stream:start', { id, mode }),
  stop: (id) => ipcRenderer.invoke('stream:stop', id),
  status: (id) => ipcRenderer.invoke('stream:status', id),
  statusAll: () => ipcRenderer.invoke('stream:statusAll'),
});
