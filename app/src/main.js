// main.js · Proceso principal de GOCAS Live (Electron)
// Arranca el store local, el motor FFmpeg y el mini servidor 127.0.0.1, crea la
// ventana y expone toda la lógica al renderer vía IPC (contextBridge en preload).

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const engine = require('./engine');
const store = require('./store');
const { startServer } = require('./server');

let mainWindow = null;
let serverPort = null;

// Carpeta de assets: en producción va empaquetada en resources/assets.
const ASSETS = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '..', 'assets');
const gocasLogo = path.join(ASSETS, 'gocas-watermark.png');

// Carpeta de manuales: en producción va empaquetada en resources/manuales
// (ver extraResources en package.json).
const MANUALES = app.isPackaged
  ? path.join(process.resourcesPath, 'manuales')
  : path.join(__dirname, '..', 'manuales');

// Lee y parsea el manifest de manuales; devuelve el array (o [] si no existe).
function readManualsManifest() {
  try {
    const raw = fs.readFileSync(path.join(MANUALES, 'manifest.json'), 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.manuales) ? data.manuales : [];
  } catch (err) {
    return [];
  }
}

// Agrega la URL servible (127.0.0.1) a cada marca de agua.
function withUrls(watermarks) {
  return watermarks.map((w) => ({ ...w, url: `http://127.0.0.1:${serverPort}/wm/${w.file}` }));
}

// Crea la ventana principal.
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 780,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#f5f1e8',
    autoHideMenuBar: true,
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

// Registra todos los canales IPC.
function registerIpc() {
  // Info básica de la app (versión, puerto del servidor local, plataforma).
  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    port: serverPort,
    platform: process.platform,
  }));

  // Datos persistidos: lives + watermarks (con url servible).
  ipcMain.handle('store:get', () => {
    const data = store.listAll();
    return { lives: data.lives, watermarks: withUrls(data.watermarks) };
  });

  // Crear/actualizar una transmisión.
  ipcMain.handle('live:save', (e, live) => store.saveLive(live));

  // Eliminar una transmisión (deteniendo su proceso primero).
  ipcMain.handle('live:delete', (e, id) => {
    engine.stop(id);
    store.deleteLive(id);
    return true;
  });

  // Agregar una marca de agua desde un archivo elegido por el usuario.
  ipcMain.handle('wm:add', async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Imágenes', extensions: ['png', 'webp', 'jpg', 'jpeg'] }],
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return null;

    const src = r.filePaths[0];
    let stat;
    try { stat = fs.statSync(src); } catch (err) {
      return { error: 'No se pudo leer el archivo.' };
    }
    if (stat.size > 3 * 1024 * 1024) return { error: 'La imagen supera los 3 MB.' };

    let name = path.basename(src, path.extname(src));
    if (name.length > 40) name = name.slice(0, 40);
    store.addWatermark({ name, sourcePath: src });
    return withUrls(store.listAll().watermarks);
  });

  // Renombrar una marca de agua.
  ipcMain.handle('wm:rename', (e, { id, name }) => {
    store.renameWatermark(id, name);
    return withUrls(store.listAll().watermarks);
  });

  // Eliminar una marca de agua.
  ipcMain.handle('wm:delete', (e, id) => {
    store.deleteWatermark(id);
    return withUrls(store.listAll().watermarks);
  });

  // Sondear una cámara RTSP.
  ipcMain.handle('probe', (e, rtspUrl) => engine.probeCamera(rtspUrl));

  // Arrancar una transmisión (youtube o preview).
  ipcMain.handle('stream:start', async (e, { id, mode }) => {
    const data = store.listAll();
    const live = data.lives.find((l) => l.id === id);
    if (!live) {
      return { status: { status: 'error', friendly: 'No se encontró la transmisión.' } };
    }

    // Validación de la clave de YouTube: debe existir, no ser una URL ni RTSP.
    if (mode === 'youtube') {
      const key = String(live.youtube_key || '').trim();
      if (!key || key.includes('://') || /^rtsp/i.test(key)) {
        return {
          status: {
            status: 'error',
            friendly: 'La clave de YouTube no es válida. Es el código corto de YouTube Studio → Transmitir en vivo → Clave de retransmisión.',
          },
        };
      }
    }

    // Resolver el archivo de la marca del usuario (si eligió una).
    let userWmFile = null;
    if (live.watermark_id) {
      const wm = data.watermarks.find((w) => w.id === live.watermark_id);
      if (wm) userWmFile = path.join(store.wmDir(), wm.file);
    }

    const status = await engine.start(id, {
      mode,
      rtspUrl: live.rtsp_url,
      streamKey: live.youtube_key,
      userWmFile,
      position: live.wm_position,
      opacity: live.wm_opacity,
      scale: live.wm_scale,
      margin: live.wm_margin,
    });
    return { status };
  });

  // Detener una transmisión.
  ipcMain.handle('stream:stop', (e, id) => ({ status: engine.stop(id) }));

  // Estado de una transmisión.
  ipcMain.handle('stream:status', (e, id) => engine.getStatus(id));

  // Estado (string) de todas las transmisiones.
  ipcMain.handle('stream:statusAll', () => engine.statusAll());

  // Listado de manuales desde el manifest (o [] si aún no hay manuales).
  ipcMain.handle('manuals:list', () => readManualsManifest());

  // Abrir un manual. Valida SIEMPRE que el archivo esté declarado en el manifest
  // (nunca rutas arbitrarias) y que quede dentro de la carpeta de manuales.
  ipcMain.handle('manuals:open', async (e, { file, type } = {}) => {
    const list = readManualsManifest();
    if (!list.length) return { error: 'No hay manuales disponibles.' };

    const allowed = new Set();
    for (const m of list) {
      if (m && m.html) allowed.add(m.html);
      if (m && m.pdf) allowed.add(m.pdf);
    }
    if (!file || typeof file !== 'string' || !allowed.has(file)) {
      return { error: 'Manual no válido.' };
    }

    const abs = path.join(MANUALES, file);
    // Defensa extra contra path traversal: el archivo resuelto debe seguir
    // dentro de MANUALES.
    const rel = path.relative(MANUALES, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return { error: 'Ruta no permitida.' };
    if (!fs.existsSync(abs)) return { error: 'Ese manual aún no está disponible en esta versión.' };

    if (type === 'pdf') {
      await shell.openPath(abs);
      return { ok: true };
    }

    // type 'html' → ventana propia de lectura.
    const win = new BrowserWindow({
      width: 920,
      height: 820,
      backgroundColor: '#f5f1e8',
      autoHideMenuBar: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    await win.loadFile(abs);
    return { ok: true };
  });
}

app.whenReady().then(async () => {
  // Inicializa datos locales.
  store.init(app.getPath('userData'));

  // Configura el motor con las rutas de HLS y el logo GOCAS.
  const hlsRoot = path.join(app.getPath('userData'), 'hls');
  engine.configure({ hlsRoot, gocasLogo });

  // Arranca el servidor local (HLS + marcas).
  const started = await startServer({ hlsRoot, wmDir: store.wmDir() });
  serverPort = started.port;

  registerIpc();
  await createWindow();
});

// Al cerrar la app, corta todas las transmisiones.
app.on('before-quit', () => {
  engine.stopAll();
});

// App utilitaria: cerrar todas las ventanas cierra la app (también en macOS).
app.on('window-all-closed', () => {
  app.quit();
});
