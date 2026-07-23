// store.js · Persistencia local en JSON de GOCAS Live
// Guarda las transmisiones (lives) y las marcas de agua del usuario en un único
// archivo JSON dentro de userData, y copia los PNG/JPG de las marcas a una
// carpeta propia. Sin base de datos: todo es local y offline.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let FILE = null;    // ruta del gocas-store.json
let WM_DIR = null;  // carpeta de archivos de marcas de agua

// Inicializa rutas y crea la carpeta de marcas.
function init(userDataPath) {
  FILE = path.join(userDataPath, 'gocas-store.json');
  WM_DIR = path.join(userDataPath, 'watermarks');
  try { fs.mkdirSync(WM_DIR, { recursive: true }); } catch (e) {}
  return { FILE, WM_DIR };
}

// Lee el JSON completo; ante cualquier problema devuelve una estructura vacía.
function load() {
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      lives: Array.isArray(data.lives) ? data.lives : [],
      watermarks: Array.isArray(data.watermarks) ? data.watermarks : [],
    };
  } catch (e) {
    return { lives: [], watermarks: [] };
  }
}

// Escribe el JSON completo.
function save(data) {
  const out = {
    lives: Array.isArray(data.lives) ? data.lives : [],
    watermarks: Array.isArray(data.watermarks) ? data.watermarks : [],
  };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2), 'utf8');
  return out;
}

// Devuelve todo (lives + watermarks).
function listAll() {
  return load();
}

// Crea o actualiza (merge) una transmisión. Genera id si falta.
function saveLive(live) {
  const data = load();
  const now = new Date().toISOString();
  const existing = live.id ? data.lives.find((l) => l.id === live.id) : null;

  const merged = {
    id: live.id || crypto.randomUUID(),
    title: live.title ?? existing?.title ?? '',
    description: live.description ?? existing?.description ?? '',
    rtsp_url: live.rtsp_url ?? existing?.rtsp_url ?? '',
    youtube_key: live.youtube_key ?? existing?.youtube_key ?? '',
    watermark_id: live.watermark_id ?? existing?.watermark_id ?? null,
    wm_position: live.wm_position ?? existing?.wm_position ?? 'bottom-right',
    wm_opacity: live.wm_opacity ?? existing?.wm_opacity ?? 0.85,
    wm_scale: live.wm_scale ?? existing?.wm_scale ?? 0.15,
    wm_margin: live.wm_margin ?? existing?.wm_margin ?? 24,
    created_at: existing?.created_at ?? live.created_at ?? now,
  };

  if (existing) {
    data.lives = data.lives.map((l) => (l.id === merged.id ? merged : l));
  } else {
    data.lives.push(merged);
  }
  save(data);
  return merged;
}

// Elimina una transmisión.
function deleteLive(id) {
  const data = load();
  data.lives = data.lives.filter((l) => l.id !== id);
  save(data);
  return true;
}

// Registra una marca de agua: copia el archivo a WM_DIR con un nombre uuid+ext.
function addWatermark({ name, sourcePath }) {
  const data = load();
  const ext = path.extname(sourcePath) || '.png';
  const id = crypto.randomUUID();
  const file = id + ext;
  fs.copyFileSync(sourcePath, path.join(WM_DIR, file));
  const wm = { id, name: name || 'Marca', file };
  data.watermarks.push(wm);
  save(data);
  return wm;
}

// Renombra una marca de agua.
function renameWatermark(id, name) {
  const data = load();
  data.watermarks = data.watermarks.map((w) => (w.id === id ? { ...w, name } : w));
  save(data);
  return true;
}

// Elimina una marca de agua (y su archivo físico).
function deleteWatermark(id) {
  const data = load();
  const wm = data.watermarks.find((w) => w.id === id);
  if (wm) {
    try { fs.unlinkSync(path.join(WM_DIR, wm.file)); } catch (e) {}
  }
  data.watermarks = data.watermarks.filter((w) => w.id !== id);
  save(data);
  return true;
}

// Carpeta física de las marcas de agua.
function wmDir() {
  return WM_DIR;
}

module.exports = {
  init,
  load,
  save,
  listAll,
  saveLive,
  deleteLive,
  addWatermark,
  renameWatermark,
  deleteWatermark,
  wmDir,
};
