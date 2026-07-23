// app.js · Lógica de la interfaz (renderer) de GOCAS Live.
// Vanilla JS. Consume window.gocas (definido en preload) y sirve HLS/imágenes
// desde http://127.0.0.1:<port>. Sin frameworks; todo el estado vive aquí.

'use strict';

// ── Estado global ────────────────────────────────────────────────────────────
const state = {
  info: { version: '', port: null, platform: '' },
  lives: [],
  watermarks: [],
  status: {},        // id -> objeto de estado completo (de gocas.status)
  probeCard: {},     // id -> resultado de "Probar cámara" mostrado en la tarjeta
  busyAction: {},    // id -> acción en curso (para deshabilitar botones y mostrar "…")
  hls: {},           // id -> instancia de Hls (reproductor de preview)
  confirmDelete: null, // id de live con confirmación de borrado abierta
  wmConfirmDelete: null, // id de marca con confirmación de borrado abierta
  wmRenaming: null,  // id de marca en modo renombrar
  activeTab: 'lives',
  sheetOpen: false,
  editingId: null,   // id del live que se está editando en el sheet (null = nuevo)
};

const TAB_INDEX = { lives: 0, wm: 1, help: 2 };

// ── Utilidades ───────────────────────────────────────────────────────────────
// Escapa texto para insertarlo como HTML sin riesgo de inyección.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Crea un elemento DOM a partir de una cadena HTML (un solo nodo raíz).
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Estado "idle" por defecto (cuando una transmisión no tiene sesión activa).
function idleStatus() {
  return {
    status: 'idle', mode: null,
    steps: { camera: 'pending', engine: 'pending', youtube: 'pending', live: 'pending' },
    friendly: null, lastError: null, restarts: 0, startedAt: null,
    progress: { outTime: null, bitrate: null, speed: null }, logTail: [],
  };
}

// ¿La transmisión está "activa" (ni detenida ni en error)?
function isActive(st) {
  return st && st !== 'idle' && st !== 'error';
}

// Extrae el host (host:puerto) de una URL RTSP OCULTANDO usuario:clave.
function cameraHost(rtsp) {
  if (!rtsp) return 'Sin URL de cámara';
  const m = /^rtsps?:\/\/(?:[^@/]*@)?([^/?#\s]+)/i.exec(String(rtsp).trim());
  return m ? m[1] : 'Cámara';
}

// Referencia al nodo de tarjeta de un live por id.
function cardEl(id) {
  return document.querySelector(`.live-card[data-id="${CSS.escape(id)}"]`);
}

// ── Arranque ─────────────────────────────────────────────────────────────────
async function boot() {
  try {
    state.info = await gocas.info();
  } catch (e) {
    console.error('No se pudo leer info de la app:', e);
  }
  const v = document.getElementById('version');
  if (v && state.info.version) v.textContent = 'v' + state.info.version;

  try {
    await refreshStore();
  } catch (e) {
    toast('error', 'No se pudieron cargar los datos locales.');
  }

  wireStaticListeners();
  renderActiveView();
  startPolling();
}

// Refresca lives + watermarks desde el store local.
async function refreshStore() {
  const s = await gocas.store();
  state.lives = Array.isArray(s.lives) ? s.lives : [];
  state.watermarks = Array.isArray(s.watermarks) ? s.watermarks : [];
}

// ── Listeners estáticos (delegación de eventos) ──────────────────────────────
function wireStaticListeners() {
  // Segmented control: cambio de pestaña.
  document.getElementById('seg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    setTab(btn.dataset.tab);
  });

  // Delegación de clics para todos los botones con data-action.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t || t.disabled) return;
    handleAction(t.dataset.action, t.dataset.id, t, e);
  });
}

// Cambia de pestaña y mueve el thumb del segmented control.
function setTab(tab) {
  if (!(tab in TAB_INDEX)) return;
  state.activeTab = tab;
  const seg = document.getElementById('seg');
  seg.dataset.active = String(TAB_INDEX[tab]);
  seg.querySelectorAll('.seg-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.tab === tab);
  });
  renderActiveView();
}

// Renderiza la vista de la pestaña activa.
function renderActiveView() {
  if (state.activeTab === 'lives') renderLives();
  else if (state.activeTab === 'wm') renderWatermarks();
  else renderHelp();
}

// ── Enrutador de acciones ────────────────────────────────────────────────────
function handleAction(action, id, target, e) {
  switch (action) {
    // Transmisiones
    case 'new-live': openEditor(null); break;
    case 'edit': openEditor(state.lives.find((l) => l.id === id) || null); break;
    case 'probe': probeCard(id); break;
    case 'preview': doPreview(id); break;
    case 'stream': transmit(id, 'stream'); break;
    case 'to-youtube': transmit(id, 'to-youtube'); break;
    case 'stop': stopLive(id); break;
    case 'delete-ask': state.confirmDelete = id; syncCardActions(id); break;
    case 'delete-no': state.confirmDelete = null; syncCardActions(id); break;
    case 'delete-yes': deleteLive(id); break;
    // Marcas de agua
    case 'wm-add': addWatermark(); break;
    case 'wm-rename': state.wmRenaming = id; renderWatermarks(); focusRename(id); break;
    case 'wm-rename-save': saveRename(id); break;
    case 'wm-rename-cancel': state.wmRenaming = null; renderWatermarks(); break;
    case 'wm-del-ask': state.wmConfirmDelete = id; renderWatermarks(); break;
    case 'wm-del-no': state.wmConfirmDelete = null; renderWatermarks(); break;
    case 'wm-del-yes': deleteWatermark(id); break;
    // Editor (sheet)
    case 'sheet-cancel': closeSheet(); break;
    case 'sheet-save': saveEditor(); break;
    case 'sheet-probe': editorProbe(); break;
    case 'sheet-backdrop': if (e.target.classList.contains('sheet-backdrop')) closeSheet(); break;
    default: break;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  PESTAÑA: TRANSMISIONES
// ═════════════════════════════════════════════════════════════════════════════

function renderLives() {
  const view = document.getElementById('view');
  let html = `<div class="section-top">
      <h2 class="section-h">Transmisiones</h2>
      <button class="btn amber pill-lg" data-action="new-live">+ Nueva transmisión</button>
    </div>`;

  if (!state.lives.length) {
    html += `<div class="empty">
        <h3>Aún no tienes transmisiones</h3>
        <p>Crea una con la URL RTSP de tu cámara y sal en vivo a YouTube con tu marca de agua.</p>
        <button class="btn amber pill-lg" data-action="new-live">+ Nueva transmisión</button>
      </div>`;
    view.innerHTML = html;
    return;
  }

  html += `<div id="lives-list" class="lives-list"></div>`;
  view.innerHTML = html;

  const list = document.getElementById('lives-list');
  for (const live of state.lives) list.appendChild(buildLiveCard(live));
  // Llena las zonas de estado y monta el preview si corresponde.
  for (const live of state.lives) syncCard(live.id);
}

// Construye el "esqueleto" de una tarjeta de transmisión (zonas de estado vacías).
function buildLiveCard(live) {
  const wm = live.watermark_id ? state.watermarks.find((w) => w.id === live.watermark_id) : null;
  const thumb = wm
    ? `<img src="${esc(wm.url)}" alt="Marca ${esc(wm.name)}" /><span>${esc(wm.name)}</span>`
    : `<span class="thumb-none">solo logo GOCAS</span>`;

  return el(`<article class="card live-card" data-id="${esc(live.id)}">
      <div class="live-head">
        <div class="live-titles">
          <h3 class="live-title">${esc(live.title || 'Transmisión sin título')}</h3>
          <div class="live-host mono">${esc(cameraHost(live.rtsp_url))}</div>
        </div>
        <div class="live-thumb">${thumb}</div>
      </div>
      <div class="live-chip-row">
        <span class="js-chip"></span>
        <span class="js-probe"></span>
      </div>
      <div class="js-timeline live-timeline"></div>
      <div class="js-statusmsg live-statusmsg"></div>
      <div class="js-preview live-preview"></div>
      <details class="live-details js-details" hidden>
        <summary>Ver detalles técnicos</summary>
        <pre class="js-log log-box"></pre>
      </details>
      <div class="js-actions live-actions"></div>
    </article>`);
}

// Actualiza SOLO las zonas de estado de una tarjeta ya existente (sin recrearla,
// preservando el reproductor de preview y sin cerrar sheets abiertos).
function syncCard(id) {
  const card = cardEl(id);
  if (!card) return;
  const live = state.lives.find((l) => l.id === id);
  if (!live) return;
  const status = state.status[id] || idleStatus();

  card.querySelector('.js-chip').innerHTML = chipHtml(status);
  card.querySelector('.js-probe').innerHTML = probeHtml(id);
  card.querySelector('.js-timeline').innerHTML = timelineHtml(status);
  card.querySelector('.js-statusmsg').innerHTML = statusMsgHtml(status);
  card.querySelector('.js-actions').innerHTML = actionsHtml(live, status);
  updateLog(card, status);
  ensurePreview(id, status);
}

// Actualiza solo la fila de acciones (para cambios de confirmación de borrado).
function syncCardActions(id) {
  const card = cardEl(id);
  if (!card) return;
  const live = state.lives.find((l) => l.id === id);
  const status = state.status[id] || idleStatus();
  card.querySelector('.js-actions').innerHTML = actionsHtml(live, status);
}

// Chip de estado según el status.
function chipHtml(status) {
  const s = status.status;
  const map = {
    idle: ['chip-idle', 'Detenido'],
    probing: ['chip-working', 'Probando'],
    starting: ['chip-working', 'Iniciando'],
    preview: ['chip-preview', 'Preview'],
    sending: ['chip-sending', 'Enviando'],
    live: ['chip-live', 'EN VIVO'],
    restarting: ['chip-restarting', 'Reconectando'],
    error: ['chip-error', 'Error'],
  };
  const [cls, label] = map[s] || map.idle;
  return `<span class="chip ${cls}">${label}</span>`;
}

// Resultado inline de "Probar cámara" en la tarjeta.
function probeHtml(id) {
  const r = state.probeCard[id];
  if (!r) return '';
  if (r.ok) {
    const dims = (r.width && r.height) ? ` ${r.width}x${r.height}` : '';
    const fps = r.fps ? `@${r.fps}` : '';
    return `<span class="chip chip-online">Cámara en línea · ${esc(r.codec || 'video')}${dims}${fps} · audio: ${r.hasAudio ? 'sí' : 'no'}</span>`;
  }
  return `<span class="chip chip-error">${esc(r.friendly || 'La cámara no respondió.')}</span>`;
}

// Timeline de 4 pasos (o 3 en preview: el paso "En vivo" no aplica).
function timelineHtml(status) {
  const s = status.status;
  if (s === 'idle') return ''; // oculto cuando está detenido
  const st = status.steps || {};
  const preview = status.mode === 'preview';

  let steps;
  if (preview) {
    const p3 = s === 'preview' ? 'ok' : (s === 'error' ? 'fail' : 'pending');
    steps = [
      [st.camera || 'pending', 'Cámara'],
      [st.engine || 'pending', 'Procesador'],
      [p3, 'Preview'],
    ];
  } else {
    steps = [
      [st.camera || 'pending', 'Cámara'],
      [st.engine || 'pending', 'Procesador'],
      [st.youtube || 'pending', 'YouTube'],
      [st.live || 'pending', 'En vivo'],
    ];
  }

  const dots = steps.map(([state_, label]) => {
    const mark = state_ === 'ok' ? '✓' : (state_ === 'fail' ? '✕' : '');
    return `<div class="tl-step ${state_}">
        <div class="tl-line"></div>
        <div class="tl-dot ${state_}">${mark}</div>
        <div class="tl-label">${label}</div>
      </div>`;
  }).join('');

  return `<div class="timeline">${dots}</div>`;
}

// Mensaje bajo el timeline: error amigable, reconexión o línea de progreso.
function statusMsgHtml(status) {
  const s = status.status;
  if (s === 'error') {
    return `<div class="statusmsg danger">${esc(status.friendly || 'Ocurrió un error.')}</div>`;
  }
  if (s === 'restarting') {
    return `<div class="statusmsg warn">Se interrumpió la señal; reconectando…</div>`;
  }
  const p = status.progress || {};
  if (p.outTime && (s === 'sending' || s === 'live')) {
    return `<div class="statusmsg ok">Enviando ${esc(p.outTime)}${p.bitrate ? ' · ' + esc(p.bitrate) : ''}${p.speed ? ' · ' + esc(p.speed) : ''}</div>`;
  }
  if (p.outTime && s === 'preview') {
    return `<div class="statusmsg ok">Preview ${esc(p.outTime)}${p.bitrate ? ' · ' + esc(p.bitrate) : ''}${p.speed ? ' · ' + esc(p.speed) : ''}</div>`;
  }
  if (s === 'probing' || s === 'starting') {
    return `<div class="statusmsg muted">Preparando la transmisión…</div>`;
  }
  return '';
}

// Botón con manejo de "ocupado" (deshabilita y muestra "…" en la acción en curso).
function actBtn(action, id, label, cls) {
  const busy = state.busyAction[id];
  const disabled = busy ? 'disabled' : '';
  const text = busy === action ? '…' : label;
  return `<button class="btn ${cls}" data-action="${action}" data-id="${esc(id)}" ${disabled}>${text}</button>`;
}

// Acciones de la tarjeta según el estado.
function actionsHtml(live, status) {
  const s = status.status;
  if (isActive(s)) {
    let html = actBtn('stop', live.id, 'Detener', 'danger');
    if (s === 'preview') html += actBtn('to-youtube', live.id, 'Transmitir a YouTube', 'olive');
    return html;
  }
  // Detenido o error: set completo de acciones.
  let html = '';
  html += actBtn('probe', live.id, 'Probar cámara', 'ghost');
  html += actBtn('preview', live.id, 'Preview', 'olive');
  html += actBtn('stream', live.id, 'Transmitir', 'amber');
  html += actBtn('edit', live.id, 'Editar', 'ghost');
  if (state.confirmDelete === live.id) {
    html += `<span class="confirm-inline">¿Eliminar? ${actBtn('delete-yes', live.id, 'Sí', 'danger sm')}${actBtn('delete-no', live.id, 'No', 'ghost sm')}</span>`;
  } else {
    html += actBtn('delete-ask', live.id, 'Eliminar', 'ghost danger-text');
  }
  return html;
}

// Actualiza el log técnico (solo si cambió) y auto-scroll al final.
function updateLog(card, status) {
  const details = card.querySelector('.js-details');
  const pre = card.querySelector('.js-log');
  const txt = (status.logTail || []).join('\n');
  if (txt) {
    details.hidden = false;
    if (pre.textContent !== txt) {
      pre.textContent = txt;
      pre.scrollTop = pre.scrollHeight;
    }
  } else {
    details.hidden = true;
    pre.textContent = '';
  }
}

// ── Reproductor de preview (HLS) ─────────────────────────────────────────────
// Monta o desmonta el <video> de preview según el estado, sin recrearlo en cada
// tick de polling (para no cortar la reproducción).
function ensurePreview(id, status) {
  const card = cardEl(id);
  if (!card) return;
  const box = card.querySelector('.js-preview');
  const show = status.status === 'preview' && status.mode === 'preview';

  if (show) {
    if (!box.querySelector('video')) {
      box.innerHTML = `<div class="preview-inner">
          <video id="video-${esc(id)}" class="preview-video" playsinline muted controls></video>
          <div class="preview-cap">Así se verá tu live (marcas incluidas).</div>
          <button class="btn amber" data-action="to-youtube" data-id="${esc(id)}">Todo se ve bien → Transmitir a YouTube</button>
        </div>`;
      attachHls(id);
    }
  } else if (box.querySelector('video')) {
    destroyHls(id);
    box.innerHTML = '';
  }
}

// Conecta hls.js (o el reproductor nativo) al <video> del preview.
function attachHls(id) {
  const video = document.getElementById('video-' + id);
  if (!video) return;
  const url = `http://127.0.0.1:${state.info.port}/hls/${id}/index.m3u8`;
  destroyHls(id);

  if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls({
      liveSyncDurationCount: 3,
      manifestLoadingMaxRetry: 12,
      manifestLoadingRetryDelay: 1000,
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    hls.on(window.Hls.Events.ERROR, (evt, data) => {
      // Errores fatales: intenta recuperarse (el preview HLS aún puede estar generándose).
      if (data && data.fatal) {
        try {
          if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else hls.startLoad();
        } catch (e) { /* ignora */ }
      }
    });
    state.hls[id] = hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Fallback nativo (Safari/WebKit).
    video.src = url;
    video.addEventListener('loadedmetadata', () => { video.play().catch(() => {}); });
  }
}

// Destruye la instancia de hls.js de un id (si existe).
function destroyHls(id) {
  const h = state.hls[id];
  if (h) {
    try { h.destroy(); } catch (e) { /* ignora */ }
    delete state.hls[id];
  }
}

// ── Acciones de transmisión ──────────────────────────────────────────────────
// Guarda el estado devuelto y refresca la tarjeta.
function applyStatus(id, status) {
  if (status) state.status[id] = status;
  if (state.activeTab === 'lives') syncCard(id);
}

// Probar cámara desde la tarjeta.
async function probeCard(id) {
  const live = state.lives.find((l) => l.id === id);
  if (!live) return;
  state.busyAction[id] = 'probe';
  syncCardActions(id);
  try {
    const r = await gocas.probe(live.rtsp_url);
    state.probeCard[id] = r;
    if (r.ok) toast('success', 'Cámara en línea.');
    else toast('error', r.friendly || 'La cámara no respondió.');
  } catch (e) {
    state.probeCard[id] = { ok: false, friendly: e.message };
    toast('error', 'Error al probar la cámara: ' + e.message);
  } finally {
    state.busyAction[id] = null;
    syncCard(id);
  }
}

// Iniciar preview.
async function doPreview(id) {
  state.busyAction[id] = 'preview';
  syncCardActions(id);
  try {
    const r = await gocas.start(id, 'preview');
    applyStatus(id, r.status);
    if (r.status && r.status.status === 'error') {
      toast('error', r.status.friendly || 'No se pudo generar el preview.');
    } else {
      toast('info', 'Generando el preview…');
    }
  } catch (e) {
    toast('error', 'Error al iniciar el preview: ' + e.message);
  } finally {
    state.busyAction[id] = null;
    syncCard(id);
  }
}

// Transmitir a YouTube (desde el botón "Transmitir" o desde el preview).
async function transmit(id, busyAs) {
  const live = state.lives.find((l) => l.id === id);
  if (!live) return;
  const key = String(live.youtube_key || '').trim();
  if (!key || key.includes('://')) {
    toast('warn', 'Añade la clave de retransmisión de YouTube para salir en vivo.');
    openEditor(live, { focusKey: true });
    return;
  }
  state.busyAction[id] = busyAs;
  syncCardActions(id);
  try {
    const r = await gocas.start(id, 'youtube');
    applyStatus(id, r.status);
    if (r.status && r.status.status === 'error') {
      toast('error', r.status.friendly || 'No se pudo iniciar la transmisión.');
    } else {
      toast('info', 'Conectando con YouTube…');
    }
  } catch (e) {
    toast('error', 'Error al transmitir: ' + e.message);
  } finally {
    state.busyAction[id] = null;
    syncCard(id);
  }
}

// Detener una transmisión / preview.
async function stopLive(id) {
  state.busyAction[id] = 'stop';
  syncCardActions(id);
  try {
    const r = await gocas.stop(id);
    destroyHls(id);
    applyStatus(id, r.status);
    toast('info', 'Transmisión detenida.');
  } catch (e) {
    toast('error', 'Error al detener: ' + e.message);
  } finally {
    state.busyAction[id] = null;
    syncCard(id);
  }
}

// Eliminar una transmisión (tras confirmación inline).
async function deleteLive(id) {
  state.busyAction[id] = 'delete-yes';
  syncCardActions(id);
  try {
    await gocas.deleteLive(id);
    state.confirmDelete = null;
    delete state.status[id];
    delete state.probeCard[id];
    destroyHls(id);
    await refreshStore();
    renderLives();
    toast('success', 'Transmisión eliminada.');
  } catch (e) {
    state.busyAction[id] = null;
    syncCard(id);
    toast('error', 'Error al eliminar: ' + e.message);
  }
}

// ── Polling de estado ────────────────────────────────────────────────────────
// Cada 1.5s pregunta el estado de todas las transmisiones y actualiza los chips /
// timelines SIN destruir el player de preview ni cerrar sheets.
function startPolling() {
  setInterval(async () => {
    if (!state.lives.length) return;
    let map;
    try {
      map = await gocas.statusAll(); // { id: statusString }
    } catch (e) {
      return;
    }
    // Trae el estado completo de las transmisiones que no estén detenidas.
    for (const live of state.lives) {
      const st = map ? map[live.id] : undefined;
      const known = state.status[live.id];
      const nonIdle = (st && st !== 'idle') || (known && known.status && known.status !== 'idle');
      if (nonIdle) {
        try {
          state.status[live.id] = await gocas.status(live.id);
        } catch (e) { /* ignora un fallo puntual de polling */ }
      }
    }
    if (state.activeTab === 'lives') {
      for (const live of state.lives) syncCard(live.id);
    }
  }, 1500);
}

// ═════════════════════════════════════════════════════════════════════════════
//  EDITOR (SHEET)
// ═════════════════════════════════════════════════════════════════════════════

// Abre el editor de una transmisión (live existente o null para crear una nueva).
function openEditor(live, opts) {
  opts = opts || {};
  const isNew = !live;
  const draft = {
    id: live ? live.id : null,
    title: live ? (live.title || '') : '',
    rtsp_url: live ? (live.rtsp_url || '') : '',
    youtube_key: live ? (live.youtube_key || '') : '',
    watermark_id: live ? (live.watermark_id || '') : '',
    wm_position: live ? (live.wm_position || 'bottom-right') : 'bottom-right',
    wm_scale: live ? (live.wm_scale != null ? live.wm_scale : 0.15) : 0.15,
    wm_opacity: live ? (live.wm_opacity != null ? live.wm_opacity : 0.85) : 0.85,
    wm_margin: live ? (live.wm_margin != null ? live.wm_margin : 24) : 24,
  };

  const scalePct = Math.round(draft.wm_scale * 100);
  const opacityPct = Math.round(draft.wm_opacity * 100);
  const marginPx = Math.round(draft.wm_margin);

  const wmOptions = ['<option value="">Sin marca (solo logo GOCAS)</option>']
    .concat(state.watermarks.map((w) =>
      `<option value="${esc(w.id)}" ${w.id === draft.watermark_id ? 'selected' : ''}>${esc(w.name)}</option>`))
    .join('');

  const positions = [
    ['top-left', 'Arriba izquierda'],
    ['top-right', 'Arriba derecha'],
    ['bottom-left', 'Abajo izquierda'],
    ['bottom-right', 'Abajo derecha'],
    ['center', 'Centro'],
  ];
  const posOptions = positions.map(([v, l]) =>
    `<option value="${v}" ${v === draft.wm_position ? 'selected' : ''}>${l}</option>`).join('');

  state.editingId = draft.id; // id del live a actualizar (null si es nuevo)

  const root = document.getElementById('sheet-root');
  const backdrop = el(`<div class="sheet-backdrop" data-action="sheet-backdrop">
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-grip"></div>
        <div class="sheet-head">
          <h2>${isNew ? 'Nueva transmisión' : 'Editar transmisión'}</h2>
          <button class="btn ghost sm" data-action="sheet-cancel">Cancelar</button>
        </div>
        <div class="sheet-body">
          <div class="field">
            <label for="f-title">Título</label>
            <input id="f-title" class="input" type="text" placeholder="Ej. Cancha central" value="${esc(draft.title)}" />
          </div>

          <div class="field">
            <label for="f-rtsp">URL RTSP de la cámara</label>
            <div class="field-inline">
              <input id="f-rtsp" class="input mono" type="text" spellcheck="false"
                     placeholder="rtsp://usuario:clave@192.168.1.10:554/stream1" value="${esc(draft.rtsp_url)}" />
              <button class="btn ghost" data-action="sheet-probe">Probar</button>
            </div>
            <div id="f-probe-result" class="field-result"></div>
          </div>

          <div class="field">
            <label for="f-key">Clave de YouTube</label>
            <input id="f-key" class="input mono" type="password" autocomplete="off" spellcheck="false"
                   placeholder="xxxx-xxxx-xxxx-xxxx" value="${esc(draft.youtube_key)}" />
            <div class="hint">El código corto de YouTube Studio → Transmitir en vivo → “Clave de retransmisión”. Se guarda solo en este equipo.</div>
          </div>

          <div class="field">
            <label for="f-wm">Marca de agua</label>
            <select id="f-wm" class="select">${wmOptions}</select>
          </div>

          <div class="field">
            <label for="f-pos">Posición</label>
            <select id="f-pos" class="select">${posOptions}</select>
          </div>

          <div class="field">
            <label for="f-scale">Tamaño</label>
            <div class="slider-row">
              <input id="f-scale" type="range" min="5" max="100" step="1" value="${scalePct}" />
              <output id="o-scale">${scalePct}%</output>
            </div>
          </div>

          <div class="field">
            <label for="f-op">Opacidad</label>
            <div class="slider-row">
              <input id="f-op" type="range" min="20" max="100" step="1" value="${opacityPct}" />
              <output id="o-op">${opacityPct}%</output>
            </div>
          </div>

          <div class="field">
            <label for="f-margin">Margen</label>
            <div class="slider-row">
              <input id="f-margin" type="range" min="0" max="120" step="1" value="${marginPx}" />
              <output id="o-margin">${marginPx}px</output>
            </div>
          </div>

          <div class="field">
            <label>Vista previa del marco</label>
            <div class="frame-preview" id="frame-preview">
              <img class="fp-user" id="fp-user" alt="Marca de agua" />
              <img class="fp-gocas" src="../assets/gocas-watermark.png" alt="Logo GOCAS" />
            </div>
            <div class="frame-hint">El logo GOCAS (abajo a la izquierda) va siempre; tu marca se posiciona según los ajustes.</div>
          </div>

          <div class="sheet-actions">
            <button class="btn ghost" data-action="sheet-cancel">Cancelar</button>
            <button class="btn amber" data-action="sheet-save">Guardar</button>
          </div>
        </div>
      </div>
    </div>`);

  root.innerHTML = '';
  root.appendChild(backdrop);
  state.sheetOpen = true;

  // Listeners de los inputs que refrescan la vista previa del marco.
  const ids = ['f-wm', 'f-pos', 'f-scale', 'f-op', 'f-margin'];
  ids.forEach((fid) => {
    document.getElementById(fid).addEventListener('input', updateFramePreview);
  });
  updateFramePreview();

  // Animación de entrada.
  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    backdrop.querySelector('.sheet').classList.add('show');
  });

  // Foco inicial.
  setTimeout(() => {
    const focusEl = opts.focusKey ? document.getElementById('f-key') : document.getElementById('f-title');
    if (focusEl) focusEl.focus();
  }, 120);
}

// Cierra el editor con animación.
function closeSheet() {
  const backdrop = document.querySelector('.sheet-backdrop');
  if (!backdrop) return;
  state.sheetOpen = false;
  state.editingId = null;
  backdrop.classList.remove('show');
  const sheet = backdrop.querySelector('.sheet');
  if (sheet) sheet.classList.remove('show');
  setTimeout(() => {
    const root = document.getElementById('sheet-root');
    root.innerHTML = '';
  }, 420);
}

// Refleja en vivo la marca elegida (posición/tamaño/opacidad/margen) en la caja.
function updateFramePreview() {
  const wmId = document.getElementById('f-wm').value;
  const pos = document.getElementById('f-pos').value;
  const scale = Number(document.getElementById('f-scale').value); // %
  const op = Number(document.getElementById('f-op').value);       // %
  const margin = Number(document.getElementById('f-margin').value); // px (ref 1920)

  // Etiquetas de los sliders.
  document.getElementById('o-scale').textContent = scale + '%';
  document.getElementById('o-op').textContent = op + '%';
  document.getElementById('o-margin').textContent = margin + 'px';

  const img = document.getElementById('fp-user');
  const wm = wmId ? state.watermarks.find((w) => w.id === wmId) : null;
  if (wm) {
    img.src = wm.url;
    img.style.display = 'block';
    img.style.width = scale + '%';
    img.style.opacity = String(op / 100);
    // Reinicia posiciones.
    img.style.top = img.style.bottom = img.style.left = img.style.right = 'auto';
    img.style.transform = 'none';
    const mPct = (margin / 1920 * 100) + '%'; // margen proporcional a un frame de 1920px
    switch (pos) {
      case 'top-left': img.style.top = mPct; img.style.left = mPct; break;
      case 'top-right': img.style.top = mPct; img.style.right = mPct; break;
      case 'bottom-left': img.style.bottom = mPct; img.style.left = mPct; break;
      case 'center':
        img.style.top = '50%'; img.style.left = '50%';
        img.style.transform = 'translate(-50%, -50%)';
        break;
      case 'bottom-right':
      default: img.style.bottom = mPct; img.style.right = mPct; break;
    }
  } else {
    img.style.display = 'none';
  }
}

// Prueba la cámara con el valor ACTUAL del campo RTSP del editor.
async function editorProbe() {
  const url = document.getElementById('f-rtsp').value.trim();
  const out = document.getElementById('f-probe-result');
  out.innerHTML = `<span class="chip chip-working">Probando…</span>`;
  try {
    const r = await gocas.probe(url);
    if (r.ok) {
      const dims = (r.width && r.height) ? ` ${r.width}x${r.height}` : '';
      const fps = r.fps ? `@${r.fps}` : '';
      out.innerHTML = `<span class="chip chip-online">Cámara en línea · ${esc(r.codec || 'video')}${dims}${fps} · audio: ${r.hasAudio ? 'sí' : 'no'}</span>`;
    } else {
      out.innerHTML = `<span class="chip chip-error">${esc(r.friendly || 'La cámara no respondió.')}</span>`;
    }
  } catch (e) {
    out.innerHTML = `<span class="chip chip-error">${esc(e.message)}</span>`;
  }
}

// Valida y guarda la transmisión del editor.
async function saveEditor() {
  const title = document.getElementById('f-title').value.trim();
  const key = document.getElementById('f-key').value.trim();

  if (!title) {
    toast('error', 'El título es obligatorio.');
    document.getElementById('f-title').focus();
    return;
  }
  if (key.includes('://')) {
    toast('error', 'Eso parece una URL, no la clave de YouTube.');
    document.getElementById('f-key').focus();
    return;
  }

  const live = {
    title,
    rtsp_url: document.getElementById('f-rtsp').value.trim(),
    youtube_key: key,
    watermark_id: document.getElementById('f-wm').value || null,
    wm_position: document.getElementById('f-pos').value,
    wm_scale: Number(document.getElementById('f-scale').value) / 100,
    wm_opacity: Number(document.getElementById('f-op').value) / 100,
    wm_margin: Number(document.getElementById('f-margin').value),
  };
  if (state.editingId) live.id = state.editingId;

  const saveBtn = document.querySelector('[data-action="sheet-save"]');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '…'; }

  try {
    await gocas.saveLive(live);
    await refreshStore();
    closeSheet();
    if (state.activeTab === 'lives') renderLives();
    toast('success', 'Transmisión guardada.');
  } catch (e) {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; }
    toast('error', 'Error al guardar: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  PESTAÑA: MARCAS DE AGUA
// ═════════════════════════════════════════════════════════════════════════════

function renderWatermarks() {
  const view = document.getElementById('view');
  let html = `<div class="section-top"><h2 class="section-h">Marcas de agua</h2></div>`;
  html += `<div class="wm-notice">
      <img src="../assets/gocas-watermark.png" alt="Logo GOCAS" />
      <p>Todas las transmisiones llevan el logo GOCAS (pequeño, 75% de opacidad, abajo a la izquierda). Tu marca se añade además, donde tú elijas.</p>
    </div>`;

  html += `<div class="wm-grid">`;
  for (const wm of state.watermarks) {
    html += buildWmTile(wm);
  }
  html += `<button class="wm-add" data-action="wm-add">
      <span class="plus">+</span>
      <span>Añadir marca</span>
      <small>PNG/WebP/JPG ≤ 3MB · PNG con transparencia recomendado</small>
    </button>`;
  html += `</div>`;

  view.innerHTML = html;
}

function buildWmTile(wm) {
  const renaming = state.wmRenaming === wm.id;
  const confirming = state.wmConfirmDelete === wm.id;

  let body;
  if (renaming) {
    body = `<input class="wm-rename-input" id="rename-${esc(wm.id)}" type="text" value="${esc(wm.name)}" maxlength="40" />
      <div class="wm-row">
        <button class="btn amber sm" data-action="wm-rename-save" data-id="${esc(wm.id)}">Guardar</button>
        <button class="btn ghost sm" data-action="wm-rename-cancel" data-id="${esc(wm.id)}">Cancelar</button>
      </div>`;
  } else {
    let actions;
    if (confirming) {
      actions = `<span class="confirm-inline">¿Eliminar?
          <button class="btn danger sm" data-action="wm-del-yes" data-id="${esc(wm.id)}">Sí</button>
          <button class="btn ghost sm" data-action="wm-del-no" data-id="${esc(wm.id)}">No</button>
        </span>`;
    } else {
      actions = `<button class="btn ghost sm" data-action="wm-rename" data-id="${esc(wm.id)}">Renombrar</button>
        <button class="btn ghost sm danger-text" data-action="wm-del-ask" data-id="${esc(wm.id)}">Eliminar</button>`;
    }
    body = `<div class="wm-name">${esc(wm.name)}</div><div class="wm-row">${actions}</div>`;
  }

  return `<div class="wm-tile">
      <div class="wm-thumb"><img src="${esc(wm.url)}" alt="${esc(wm.name)}" /></div>
      <div class="wm-body">${body}</div>
    </div>`;
}

// Enfoca el input de renombrado tras renderizar.
function focusRename(id) {
  setTimeout(() => {
    const inp = document.getElementById('rename-' + id);
    if (inp) { inp.focus(); inp.select(); }
  }, 30);
}

// Añadir una marca de agua (diálogo nativo del sistema).
async function addWatermark() {
  try {
    const r = await gocas.addWatermark();
    if (r === null || r === undefined) return; // el usuario canceló
    if (r && r.error) { toast('error', r.error); return; }
    if (Array.isArray(r)) state.watermarks = r;
    else await refreshStore();
    renderWatermarks();
    toast('success', 'Marca de agua añadida.');
  } catch (e) {
    toast('error', 'Error al añadir la marca: ' + e.message);
  }
}

// Guardar el renombrado de una marca.
async function saveRename(id) {
  const inp = document.getElementById('rename-' + id);
  const name = inp ? inp.value.trim() : '';
  if (!name) { toast('error', 'El nombre no puede quedar vacío.'); return; }
  try {
    const r = await gocas.renameWatermark(id, name);
    if (Array.isArray(r)) state.watermarks = r;
    else await refreshStore();
    state.wmRenaming = null;
    renderWatermarks();
    toast('success', 'Marca renombrada.');
  } catch (e) {
    toast('error', 'Error al renombrar: ' + e.message);
  }
}

// Eliminar una marca (tras confirmación).
async function deleteWatermark(id) {
  try {
    const r = await gocas.deleteWatermark(id);
    if (Array.isArray(r)) state.watermarks = r;
    else await refreshStore();
    state.wmConfirmDelete = null;
    renderWatermarks();
    toast('success', 'Marca eliminada.');
  } catch (e) {
    toast('error', 'Error al eliminar la marca: ' + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  PESTAÑA: AYUDA
// ═════════════════════════════════════════════════════════════════════════════

function renderHelp() {
  const view = document.getElementById('view');
  view.innerHTML = `<div class="section-top"><h2 class="section-h">Ayuda</h2></div>
    <div class="help-stack">
      <div class="card help-card">
        <h3>Cómo salir en vivo</h3>
        <ol class="help-steps">
          <li>Crea la transmisión con la URL RTSP de tu cámara y pruébala.</li>
          <li>En YouTube Studio crea tu directo y copia la “Clave de retransmisión”.</li>
          <li>Haz un Preview para verificar la imagen y las marcas.</li>
          <li>Transmite: la app confirma “En vivo” solo cuando YouTube está recibiendo datos de forma estable.</li>
        </ol>
      </div>

      <div class="card help-card">
        <h3>Transmitir con el internet del celular</h3>
        <p>Conecta el PC por cable ethernet a la red de la cámara <strong>y</strong> por WiFi al hotspot del celular. Leer la cámara no gasta internet (es tráfico local); la transmisión sale por el hotspot. Windows enruta cada cosa por donde corresponde.</p>
        <p class="tip">Consejo: si la red local también tiene internet y el live sale lento, desactiva temporalmente la puerta de enlace del ethernet o ajusta la “métrica” de la interfaz para forzar que la salida use el hotspot.</p>
        <p class="tip">Alternativa: una cámara WiFi conectada al mismo hotspot que el PC. Ojo: algunos hotspots aíslan los dispositivos entre sí; pruébalo antes.</p>
      </div>

      <div class="card help-card">
        <h3>La cámara no conecta</h3>
        <ul class="help-list">
          <li>El PC y la cámara están en la misma red.</li>
          <li>La IP de la cámara es la correcta.</li>
          <li>El puerto RTSP (normalmente 554) está activo.</li>
          <li>El usuario y la clave en la URL son correctos.</li>
          <li>La ruta final es la correcta (por ejemplo /stream1 vs /stream2).</li>
          <li>Ninguna otra app está usando el stream principal: usa el sub-stream.</li>
        </ul>
      </div>
    </div>`;
}

// ═════════════════════════════════════════════════════════════════════════════
//  TOASTS
// ═════════════════════════════════════════════════════════════════════════════

function toast(kind, msg) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const valid = ['success', 'error', 'warn', 'info'];
  const k = valid.includes(kind) ? kind : 'info';
  const t = el(`<div class="toast toast-${k}">
      <span class="toast-msg">${esc(msg)}</span>
      <button class="toast-x" aria-label="Cerrar">×</button>
    </div>`);
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));

  const ms = k === 'error' ? 8000 : (k === 'warn' ? 6000 : 4500);
  let timer = setTimeout(dismiss, ms);
  function dismiss() {
    clearTimeout(timer);
    t.classList.remove('show');
    setTimeout(() => t.remove(), 320);
  }
  t.querySelector('.toast-x').addEventListener('click', dismiss);
}

// ── Init ─────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
