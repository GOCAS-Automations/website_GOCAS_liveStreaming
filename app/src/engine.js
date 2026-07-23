// engine.js · Motor FFmpeg de GOCAS Live
// Sondea la cámara, arma la línea de comandos de FFmpeg (con la doble marca de
// agua: la del usuario + el logo GOCAS forzado) y gestiona las sesiones de
// transmisión (YouTube en vivo o preview HLS local) con reintentos y estado.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ffmpeg-static apunta al binario embebido. Cuando la app va empaquetada dentro
// de app.asar, el binario real vive en app.asar.unpacked (ver asarUnpack).
let ffmpegPath = require('ffmpeg-static');
if (ffmpegPath && ffmpegPath.includes('app.asar')) ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');

// ── Constantes ───────────────────────────────────────────────────────────────
const YOUTUBE_RTMP = 'rtmp://a.rtmp.youtube.com/live2';
const MAX_RESTARTS = 30;     // reintentos tras una caída a mitad de transmisión
const LOG_LINES = 150;       // tope de líneas guardadas en el log interno
const LIVE_CONFIRM_MS = 8000; // tiempo enviando datos antes de confirmar "en vivo"

// Rutas globales seteadas por configure().
let HLS_ROOT = null;   // carpeta raíz del preview HLS
let GOCAS_LOGO = null; // PNG del logo GOCAS que se incrusta siempre (producto)

// Mapa de sesiones activas: id -> session
const sessions = new Map();

// Líneas de -progress que NO deben ir al log (son telemetría de FFmpeg).
const PROGRESS_RE = /^(frame|fps|stream_\d+_\d+_q|bitrate|total_size|out_time_us|out_time_ms|out_time|dup_frames|drop_frames|speed|progress)=/;

// ── Configuración ─────────────────────────────────────────────────────────────
// Setea las rutas globales (preview HLS y logo GOCAS forzado).
function configure({ hlsRoot, gocasLogo }) {
  HLS_ROOT = hlsRoot;
  GOCAS_LOGO = gocasLogo;
}

// ── Clasificación de errores ──────────────────────────────────────────────────
// Traduce el stderr crudo de FFmpeg a un mensaje amigable en español, o null si
// no reconoce el patrón.
function classifyError(stderrText) {
  const t = String(stderrText || '').toLowerCase();
  if (!t) return null;
  if (/401|unauthorized/.test(t))
    return 'La cámara rechazó el usuario o la contraseña. Revisa las credenciales en la URL RTSP.';
  if (/404|not found/.test(t))
    return 'La cámara respondió pero esa ruta no existe. Revisa el final de la URL (ej. /stream1, /stream2).';
  if (/connection refused/.test(t))
    return 'Nada respondió en esa IP/puerto. ¿La IP es correcta? ¿El puerto RTSP (554) está activo?';
  if (/timed out|timeout|10060/.test(t))
    return 'La cámara no respondió (tiempo agotado). ¿Este equipo está en la misma red que la cámara?';
  if (/no route to host|unreachable|10065/.test(t))
    return 'No hay ruta hacia esa IP desde este equipo. Conéctate a la red de la cámara.';
  if (/getaddrinfo|failed to resolve/.test(t))
    return 'No se pudo resolver esa dirección. Revisa la IP.';
  if ((/error opening output/.test(t) && /rtmp/.test(t)) || (/rtmp/.test(t) && /i\/o error/.test(t)))
    return 'No se pudo conectar con YouTube. Revisa tu internet y que la clave de retransmisión sea válida.';
  if (/invalid data found/.test(t))
    return 'Esa IP respondió, pero lo que envía no es un stream RTSP válido.';
  return null;
}

// ── Sonda de cámara ───────────────────────────────────────────────────────────
// Abre la cámara por 0.1s con FFmpeg para leer códec/resolución/fps/audio.
function probeCamera(rtspUrl) {
  return new Promise((resolve) => {
    if (!/^rtsps?:\/\//i.test(rtspUrl || '')) {
      return resolve({
        ok: false,
        friendly: 'La URL debe empezar con rtsp:// — ejemplo: rtsp://usuario:clave@192.168.1.10:554/stream1',
      });
    }
    const args = ['-hide_banner', '-rtsp_transport', 'tcp', '-i', rtspUrl, '-t', '0.1', '-f', 'null', '-'];
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    let killedByTimeout = false;
    let done = false;

    const timer = setTimeout(() => {
      killedByTimeout = true;
      try { proc.kill('SIGKILL'); } catch (e) {}
    }, 12000);

    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);

      const abierto = /Input #0/.test(stderr);
      const vMatch = /Stream #\d+:\d+[^\n]*Video:\s*(\w+)[^\n]*?(\d{2,5})x(\d{2,5})/.exec(stderr);
      const fpsMatch = /(\d+(?:\.\d+)?)\s*fps/.exec(stderr);
      const hasAudio = /Stream #\d+:\d+[^\n]*Audio:/.test(stderr);

      if (abierto && vMatch) {
        resolve({
          ok: true,
          codec: vMatch[1],
          width: Number(vMatch[2]),
          height: Number(vMatch[3]),
          fps: fpsMatch ? Number(fpsMatch[1]) : null,
          hasAudio,
        });
      } else if (abierto) {
        resolve({ ok: false, friendly: 'Se conectó, pero no se encontró señal de video en esa ruta.', raw: stderr });
      } else if (killedByTimeout) {
        resolve({
          ok: false,
          friendly: 'La cámara no respondió en 12 segundos. Revisa la IP y que este equipo esté en la misma red.',
          raw: stderr,
        });
      } else {
        resolve({
          ok: false,
          friendly: classifyError(stderr) || 'No se pudo conectar con la cámara.',
          raw: stderr.slice(-600),
        });
      }
    };

    proc.on('exit', () => finish());
    proc.on('error', () => finish());
  });
}

// ── Construcción del filtro de video ──────────────────────────────────────────
function clamp(v, lo, hi) {
  v = Number(v);
  if (!isFinite(v)) v = lo;
  return Math.min(hi, Math.max(lo, v));
}

// Expresión de posición del overlay según margen (px).
function positionExpr(position, m) {
  switch (position) {
    case 'top-left': return `${m}:${m}`;
    case 'top-right': return `main_w-overlay_w-${m}:${m}`;
    case 'bottom-left': return `${m}:main_h-overlay_h-${m}`;
    case 'center': return `(main_w-overlay_w)/2:(main_h-overlay_h)/2`;
    case 'bottom-right':
    default: return `main_w-overlay_w-${m}:main_h-overlay_h-${m}`;
  }
}

// Arma el filter_complex con hasta DOS overlays: la marca del usuario (opcional,
// configurable) y el logo GOCAS (siempre, forzado como producto).
function buildFilterComplex({ userWmIndex, gocasIndex, position, opacity, scale, margin }) {
  const op = clamp(opacity, 0, 1);
  const sc = clamp(scale, 0.02, 1);
  const m = Math.round(clamp(margin, 0, 600));
  const pos = positionExpr(position, m);

  let chain = '';
  let base = '[0:v]'; // video base = entrada 0 (RTSP)

  // Marca del usuario (si la eligió): opacidad y tamaño configurables.
  if (userWmIndex !== null && userWmIndex !== undefined) {
    chain += `[${userWmIndex}:v]format=rgba,colorchannelmixer=aa=${op}[uw];` +
      `[uw][0:v]scale2ref=w=main_w*${sc}:h=ow*ih/iw[uws][b0];` +
      `[b0][uws]overlay=${pos}[v1];`;
    base = '[v1]';
  }

  // Logo GOCAS: SIEMPRE, abajo-izquierda, 10% del ancho, opacidad 0.75, margen 16.
  chain += `[${gocasIndex}:v]format=rgba,colorchannelmixer=aa=0.75[gw];` +
    `[gw]${base}scale2ref=w=main_w*0.10:h=ow*ih/iw[gws][b1];` +
    `[b1][gws]overlay=16:main_h-overlay_h-16:format=auto,format=yuv420p[vout]`;

  return chain;
}

// ── Construcción de argumentos de FFmpeg ──────────────────────────────────────
function buildArgs({ mode, id, rtspUrl, streamKey, userWmFile, position, opacity, scale, margin, silent, videoBitrate = '4500k' }) {
  // Flags globales + primera entrada (RTSP sobre TCP).
  const args = [
    '-hide_banner', '-loglevel', 'warning', '-nostdin', '-stats_period', '10', '-progress', 'pipe:2',
    // Opciones de ENTRADA para el RTSP: genera PTS ausentes y corta el socket a
    // los 15s si la cámara muere a mitad (así FFmpeg sale y lo recoge la lógica
    // de reintentos, en vez de quedarse colgado).
    '-fflags', '+genpts', '-rw_timeout', '15000000',
    '-rtsp_transport', 'tcp', '-i', rtspUrl,
  ];

  // Entradas en orden: 0=rtsp, [1=marca usuario], gocas, [silencio].
  if (userWmFile) args.push('-i', userWmFile);
  args.push('-i', GOCAS_LOGO);
  if (silent) args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');

  const userWmIndex = userWmFile ? 1 : null;
  const gocasIndex = userWmFile ? 2 : 1;
  const silentIdx = gocasIndex + 1;

  const fc = buildFilterComplex({ userWmIndex, gocasIndex, position, opacity, scale, margin });
  args.push('-filter_complex', fc, '-map', '[vout]');
  args.push('-map', silent ? `${silentIdx}:a` : '0:a?');

  // Códec de video/audio. bufsize = 2x el bitrate de video.
  const vb = String(videoBitrate);
  const bufsize = `${parseInt(vb, 10) * 2}k`;
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-g', '60', '-r', '30', '-b:v', vb, '-maxrate', vb, '-bufsize', bufsize,
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100'
  );

  // Audio de la CÁMARA (no silent): reajusta los timestamps que llegan hacia
  // atrás o con deriva (causa raíz del HLS que se atasca y contribuyente a la
  // caída del RTMP). Con la pista de silencio (anullsrc) los timestamps ya son
  // limpios, así que NO se aplica.
  if (!silent) args.push('-af', 'aresample=async=1:first_pts=0');

  // Cola de muxing amplia: absorbe desfases momentáneos entre audio y video sin
  // abortar el proceso.
  args.push('-max_muxing_queue_size', '1024');

  // Salida: YouTube (flv/rtmp) o preview HLS local.
  if (mode === 'youtube') {
    // no_duration_filesize elimina los warnings "Failed to update header" del
    // muxer FLV (RTMP es un stream sin duración/tamaño conocidos).
    args.push('-flvflags', 'no_duration_filesize');
    args.push('-f', 'flv', `${YOUTUBE_RTMP}/${streamKey}`);
  } else {
    const dir = path.join(HLS_ROOT, id);
    args.push(
      '-f', 'hls', '-hls_time', '2', '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(dir, 'seg_%05d.ts'),
      path.join(dir, 'index.m3u8')
    );
  }

  return args;
}

// ── Log interno ───────────────────────────────────────────────────────────────
// Agrega una línea "amistosa" (nuestra, no de FFmpeg) al log de la sesión.
function addLog(session, text) {
  session.logTail.push(text);
  if (session.logTail.length > LOG_LINES) {
    session.logTail.splice(0, session.logTail.length - LOG_LINES);
  }
}

// Procesa un chunk de stderr de FFmpeg: separa la telemetría de -progress
// (que va a session.progress) del resto (que va al log).
function pushLog(session, chunk) {
  const lines = String(chunk).split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    if (PROGRESS_RE.test(line)) {
      const key = line.slice(0, line.indexOf('='));
      const val = line.slice(line.indexOf('=') + 1).trim();
      if (key === 'out_time') session.progress.outTime = val;
      else if (key === 'bitrate') session.progress.bitrate = val;
      else if (key === 'speed') session.progress.speed = val;
      onProgress(session);
    } else {
      addLog(session, line);
    }
  }
}

// Convierte un out_time "HH:MM:SS.micro" a milisegundos.
function outTimeToMs(t) {
  if (!t) return 0;
  const m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(String(t));
  if (!m) return 0;
  return (parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseFloat(m[3])) * 1000;
}

// Reacciona a la telemetría: detecta la primera llegada de datos y confirma
// "en vivo" tras enviar de forma estable durante LIVE_CONFIRM_MS.
function onProgress(session) {
  const ms = outTimeToMs(session.progress.outTime);
  const now = Date.now();

  // Un live de horas con hipos ocasionales nunca debe agotar los reintentos: si
  // lleva más de 60s fluyendo desde el último arranque, la conexión se considera
  // estable y el contador de reintentos vuelve a cero.
  if (session.restarts > 0 && session.lastSpawnAt && (now - session.lastSpawnAt) > 60000) {
    session.restarts = 0;
    addLog(session, 'Conexión estable de nuevo; contador de reintentos reiniciado.');
  }

  // Primera vez que FFmpeg reporta datos procesados.
  if (ms > 0 && !session.firstDataAt) {
    session.firstDataAt = now;
    if (session.mode === 'youtube') {
      session.status = 'sending';
      session.steps.youtube = 'ok';
      addLog(session, 'Conexión establecida; enviando datos a YouTube…');
    } else {
      session.status = 'preview';
    }
  }

  // Confirmación de "en vivo": lleva rato enviando sin caerse.
  if (session.firstDataAt && session.mode === 'youtube' && session.status === 'sending' && (now - session.firstDataAt) > LIVE_CONFIRM_MS) {
    session.status = 'live';
    session.steps.live = 'ok';
    addLog(session, '✔ En vivo confirmado: YouTube está recibiendo la señal de forma estable.');
  }
}

// ── Ciclo de vida del proceso FFmpeg ──────────────────────────────────────────
// Lanza (o relanza) el proceso de transmisión de una sesión ya sondeada.
function launch(id, session) {
  const o = session.opts;
  const args = buildArgs({
    mode: o.mode, id, rtspUrl: o.rtspUrl, streamKey: o.streamKey,
    userWmFile: o.userWmFile, position: o.position, opacity: o.opacity,
    scale: o.scale, margin: o.margin, silent: o.silent,
  });

  const proc = spawn(ffmpegPath, args, { windowsHide: true });
  session.proc = proc;
  session.lastSpawnAt = Date.now();
  session.steps.engine = 'ok';

  proc.on('error', (err) => {
    session.steps.engine = 'fail';
    session.status = 'error';
    session.friendly = 'No se pudo iniciar el procesador de video.';
    session.lastError = err.message;
    addLog(session, 'Error al iniciar ffmpeg: ' + err.message);
  });

  proc.stderr.on('data', (d) => pushLog(session, d));
  proc.on('exit', (code, signal) => handleExit(id, session, code, signal));
}

// Programa un respawn con backoff tras una caída de red (código de salida ≠ 0).
// Resetea el estado de flujo para que onProgress vuelva a marcar los pasos
// cuando los datos comiencen a fluir de nuevo.
function scheduleRestart(id, session, reasonLabel) {
  session.restarts++;
  session.status = 'restarting';
  const delay = Math.min(3000 * session.restarts, 15000);
  addLog(session, `${reasonLabel}; reintentando (${session.restarts}/${MAX_RESTARTS}) en ${Math.round(delay / 1000)}s…`);
  session.progress = {};
  session.firstDataAt = null;
  session.steps.youtube = 'pending';
  session.steps.live = 'pending';
  session.restartTimer = setTimeout(() => {
    if (session.manualStop) return;
    launch(id, session);
  }, delay);
}

// Maneja la salida del proceso FFmpeg. Distingue: parada manual · fallo rápido
// (nunca llegaron datos) · cierre limpio de YouTube (code 0 = terminó la
// transmisión, sin reintentos) · caída de red (code ≠ 0 = reintentar con
// backoff hasta agotar MAX_RESTARTS).
function handleExit(id, session, code, signal) {
  addLog(session, `ffmpeg finalizó (code=${code}${signal ? ', signal=' + signal : ''})`);

  if (session.manualStop) {
    session.status = 'idle';
    return;
  }

  // Nunca llegaron datos: la transmisión no se estableció → error inmediato,
  // sin reintentos (fallo rápido con clasificación de error y pasos correctos).
  if (!session.firstDataAt) {
    session.status = 'error';
    if (session.mode === 'youtube') {
      session.steps.youtube = 'fail';
      session.friendly = classifyError(session.logTail.join('\n')) ||
        'La transmisión no pudo establecerse. Revisa la clave de YouTube.';
    } else {
      session.friendly = classifyError(session.logTail.join('\n')) ||
        'No se pudo generar el preview.';
    }
    return;
  }

  // Ya hubo datos: la transmisión estaba en marcha y FFmpeg terminó.
  if (session.mode === 'youtube') {
    if (code === 0) {
      // Salida limpia sin parada manual = YouTube cerró la transmisión.
      session.status = 'error';
      session.steps.youtube = 'fail';
      session.steps.live = 'fail';
      session.friendly = 'YouTube finalizó la transmisión (¿la terminaste en YouTube Studio, o el evento venció?). Si fue un corte, pulsa Transmitir de nuevo.';
      return;
    }
    // code ≠ 0 = caída de red: reintentar con backoff.
    if (session.restarts < MAX_RESTARTS) {
      scheduleRestart(id, session, 'Conexión perdida');
    } else {
      session.status = 'error';
      session.steps.youtube = 'fail';
      session.steps.live = 'fail';
      session.friendly = 'La transmisión se cayó y no se pudo recuperar tras varios intentos. Revisa la cámara y tu internet.';
    }
    return;
  }

  // Modo preview con datos previos (el paso 3 es el preview, no YouTube).
  if (code === 0) {
    session.status = 'error';
    session.friendly = 'El preview terminó inesperadamente. Vuelve a intentarlo.';
    return;
  }
  // code ≠ 0 = mismo esquema de reintentos que en youtube.
  if (session.restarts < MAX_RESTARTS) {
    scheduleRestart(id, session, 'El preview se interrumpió');
  } else {
    session.status = 'error';
    session.friendly = 'El preview se cayó y no se pudo recuperar tras varios intentos. Vuelve a intentarlo.';
  }
}

// ── API pública ───────────────────────────────────────────────────────────────
// Arranca una transmisión: sondea la cámara y lanza FFmpeg.
async function start(id, opts) {
  stop(id); // detén cualquier sesión previa con ese id

  const session = {
    status: 'probing',
    mode: opts.mode,
    steps: { camera: 'pending', engine: 'pending', youtube: 'pending', live: 'pending' },
    friendly: null,
    lastError: null,
    logTail: [],
    progress: {},
    restarts: 0,
    manualStop: false,
    firstDataAt: null,
    startedAt: Date.now(),
    proc: null,
    restartTimer: null,
    opts: {
      mode: opts.mode,
      rtspUrl: opts.rtspUrl,
      streamKey: opts.streamKey,
      userWmFile: opts.userWmFile || null,
      position: opts.position,
      opacity: opts.opacity,
      scale: opts.scale,
      margin: opts.margin,
      silent: false,
    },
  };
  sessions.set(id, session);

  // 1) Sonda de cámara.
  const probe = await probeCamera(opts.rtspUrl);
  // Si mientras sondeábamos alguien reinició/detuvo esta sesión, no sigas.
  if (sessions.get(id) !== session) return getStatus(id);

  if (!probe.ok) {
    session.steps.camera = 'fail';
    session.status = 'error';
    session.friendly = probe.friendly;
    if (probe.raw) addLog(session, String(probe.raw).trim());
    return getStatus(id);
  }

  // 2) Cámara OK.
  session.steps.camera = 'ok';
  addLog(session, `Cámara OK: ${probe.codec} ${probe.width}x${probe.height}${probe.fps ? '@' + probe.fps : ''} · audio: ${probe.hasAudio ? 'sí' : 'no'}`);

  const silent = !probe.hasAudio;
  session.opts.silent = silent;
  if (silent) addLog(session, 'La cámara no envía audio; se añade pista de silencio (YouTube la requiere).');

  // 3) Preview: limpiar y recrear el directorio HLS del id.
  if (opts.mode === 'preview') {
    const dir = path.join(HLS_ROOT, id);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }

  // 4) Lanzar FFmpeg.
  session.status = 'starting';
  launch(id, session);
  return getStatus(id);
}

// Detiene una sesión (parada manual): mata el proceso y resetea los pasos.
function stop(id) {
  const session = sessions.get(id);
  if (!session) return getStatus(id);
  session.manualStop = true;
  if (session.restartTimer) {
    clearTimeout(session.restartTimer);
    session.restartTimer = null;
  }
  if (session.proc) {
    try { session.proc.kill('SIGKILL'); } catch (e) {}
  }
  session.status = 'idle';
  session.steps = { camera: 'pending', engine: 'pending', youtube: 'pending', live: 'pending' };
  return getStatus(id);
}

// Devuelve el estado público (recortado) de una sesión.
function getStatus(id) {
  const s = sessions.get(id);
  if (!s) {
    return {
      status: 'idle',
      mode: null,
      steps: { camera: 'pending', engine: 'pending', youtube: 'pending', live: 'pending' },
      friendly: null,
      lastError: null,
      restarts: 0,
      startedAt: null,
      progress: { outTime: null, bitrate: null, speed: null },
      logTail: [],
    };
  }
  return {
    status: s.status,
    mode: s.mode,
    steps: s.steps,
    friendly: s.friendly,
    lastError: s.lastError,
    restarts: s.restarts,
    startedAt: s.startedAt,
    progress: {
      outTime: s.progress.outTime ? String(s.progress.outTime).split('.')[0] : null, // sin decimales
      bitrate: s.progress.bitrate || null,
      speed: s.progress.speed || null,
    },
    logTail: s.logTail.slice(-60),
  };
}

// Estado (solo el string) de todas las sesiones: { id: status }.
function statusAll() {
  const out = {};
  for (const [id, s] of sessions) out[id] = s.status;
  return out;
}

// Detiene todas las sesiones (al cerrar la app).
function stopAll() {
  for (const id of sessions.keys()) stop(id);
}

module.exports = {
  configure,
  probeCamera,
  start,
  stop,
  getStatus,
  statusAll,
  stopAll,
  ffmpegPath,        // para debug
  buildFilterComplex, // para tests
  buildArgs,          // para tests
};
