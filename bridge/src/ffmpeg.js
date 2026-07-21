import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { TMP_DIR, HLS_DIR, YOUTUBE_RTMP, MAX_RESTARTS } from './config.js';

// Cuando corre empaquetado (.exe con pkg), busca ffmpeg.exe junto al ejecutable;
// en desarrollo usa el binario de ffmpeg-static.
const ffmpegPath = process.pkg
  ? path.join(path.dirname(process.execPath), 'ffmpeg.exe')
  : ffmpegStatic;

const sessions = new Map(); // id -> sesion
const LOG_LINES = 120;

function clamp(n, min, max) {
  n = Number(n);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function doubleBitrate(vb) {
  const m = /^(\d+)(k|M)?$/i.exec(String(vb).trim());
  if (!m) return '9000k';
  return `${Number(m[1]) * 2}${m[2] || ''}`;
}

async function downloadWatermark(url, id) {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar la marca de agua (HTTP ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const file = path.join(TMP_DIR, `wm_${id}.img`);
  fs.writeFileSync(file, buf);
  return file;
}

function saveWatermarkData(dataUrl, id) {
  if (!dataUrl) return null;
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const buf = Buffer.from(b64, 'base64');
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const file = path.join(TMP_DIR, `wm_${id}.img`);
  fs.writeFileSync(file, buf);
  return file;
}

export function buildFilterComplex({ position, opacity, scale, margin }) {
  const op = clamp(opacity ?? 0.85, 0, 1);
  const sc = clamp(scale ?? 0.15, 0.02, 1);
  const mg = Math.round(clamp(margin ?? 24, 0, 600));
  const positions = {
    'top-left': `${mg}:${mg}`,
    'top-right': `main_w-overlay_w-${mg}:${mg}`,
    'bottom-left': `${mg}:main_h-overlay_h-${mg}`,
    'bottom-right': `main_w-overlay_w-${mg}:main_h-overlay_h-${mg}`,
    center: `(main_w-overlay_w)/2:(main_h-overlay_h)/2`,
  };
  const pos = positions[position] || positions['bottom-right'];
  return (
    `[1:v]format=rgba,colorchannelmixer=aa=${op}[wm];` +
    `[wm][0:v]scale2ref=w=main_w*${sc}:h=ow*ih/iw[wmS][base];` +
    `[base][wmS]overlay=${pos}:format=auto,format=yuv420p[vout]`
  );
}

// Sonda rapida: ¿el RTSP trae pista de audio? YouTube EXIGE audio; muchas camaras
// IP no lo envian y YouTube se queda en "sin datos" sin dar error.
export function probeHasAudio(rtspUrl) {
  return new Promise((resolve) => {
    const p = spawn(
      ffmpegPath,
      ['-hide_banner', '-rtsp_transport', 'tcp', '-i', rtspUrl, '-t', '0.1', '-f', 'null', '-'],
      { windowsHide: true },
    );
    let err = '';
    const timer = setTimeout(() => {
      try {
        p.kill('SIGKILL');
      } catch {
        /* noop */
      }
    }, 8000);
    p.stderr.on('data', (d) => {
      err += d.toString();
    });
    const done = () => {
      clearTimeout(timer);
      resolve(/Stream #\d+:\d+[^\n]*Audio:/.test(err));
    };
    p.on('exit', done);
    p.on('error', done);
  });
}

function buildArgs({ mode, id, rtspUrl, streamKey, watermarkFile, position, opacity, scale, margin, audio, videoBitrate }) {
  const vb = String(videoBitrate || '4500k');
  const silent = (audio || 'camera') === 'silent';

  const args = ['-hide_banner', '-loglevel', 'warning', '-nostdin',
    '-stats_period', '10', '-progress', 'pipe:2',
    '-rtsp_transport', 'tcp', '-i', rtspUrl];
  if (watermarkFile) args.push('-i', watermarkFile);
  if (silent) args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');

  if (watermarkFile) {
    args.push('-filter_complex', buildFilterComplex({ position, opacity, scale, margin }), '-map', '[vout]');
  } else {
    args.push('-vf', 'format=yuv420p', '-map', '0:v');
  }
  // audio: indice depende de cuantas entradas haya
  const silentIdx = watermarkFile ? 2 : 1;
  args.push('-map', silent ? `${silentIdx}:a` : '0:a?');

  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-g', '60', '-r', '30', '-b:v', vb, '-maxrate', vb, '-bufsize', doubleBitrate(vb),
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
  );

  if (mode === 'youtube') {
    args.push('-f', 'flv', `${YOUTUBE_RTMP}/${streamKey}`);
  } else {
    const dir = path.join(HLS_DIR, id);
    args.push(
      '-f', 'hls', '-hls_time', '2', '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+omit_endlist', '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(dir, 'seg_%05d.ts'), path.join(dir, 'index.m3u8'),
    );
  }
  return args;
}

// Lineas de -progress (clave=valor): no van al log; guardamos lo util en session.progress
const PROGRESS_KEYS =
  /^(frame|fps|stream_\d+_\d+_q|bitrate|total_size|out_time_us|out_time_ms|out_time|dup_frames|drop_frames|speed|progress)=/;

function pushLog(session, chunk) {
  for (const l of String(chunk).split(/\r?\n/)) {
    const line = l.trim();
    if (!line) continue;
    if (PROGRESS_KEYS.test(line)) {
      const [k, v] = line.split('=');
      if (k === 'out_time') session.progress.outTime = v;
      else if (k === 'bitrate') session.progress.bitrate = v;
      else if (k === 'speed') session.progress.speed = v;
      continue;
    }
    session.logTail.push(line);
  }
  if (session.logTail.length > LOG_LINES) session.logTail.splice(0, session.logTail.length - LOG_LINES);
}

function spawnFfmpeg(id, opts, session) {
  const proc = spawn(ffmpegPath, buildArgs({ id, ...opts }), { windowsHide: true });
  session.proc = proc;
  session.status = opts.mode === 'youtube' ? 'live' : 'preview';
  proc.stderr.on('data', (d) => pushLog(session, d.toString()));
  proc.on('error', (err) => {
    session.status = 'error';
    session.lastError = err.message;
    pushLog(session, `ERROR: ${err.message}`);
  });
  proc.on('exit', (code, signal) => {
    pushLog(session, `ffmpeg finalizo (code=${code} signal=${signal})`);
    session.proc = null;
    if (session.manualStop) {
      session.status = 'idle';
      return;
    }
    if (session.restarts < MAX_RESTARTS) {
      session.restarts += 1;
      session.status = 'restarting';
      const delay = Math.min(2000 * session.restarts, 10000);
      pushLog(session, `Reintentando en ${delay}ms (${session.restarts}/${MAX_RESTARTS})`);
      session.restartTimer = setTimeout(() => {
        if (!session.manualStop) spawnFfmpeg(id, opts, session);
      }, delay);
    } else {
      session.status = 'error';
      session.lastError = `FFmpeg termino (code=${code}) tras ${session.restarts} reintentos. Revisa la URL RTSP / la clave de YouTube.`;
    }
  });
}

export async function start(id, opts) {
  const { mode, rtspUrl, streamKey } = opts;
  if (!rtspUrl) throwHttp(400, 'Falta la URL RTSP.');
  if (mode === 'youtube' && !streamKey) throwHttp(400, 'Falta la clave de retransmision de YouTube.');

  stop(id); // limpia previo

  const watermarkFile = opts.watermarkData
    ? saveWatermarkData(opts.watermarkData, id)
    : await downloadWatermark(opts.watermarkUrl, id);

  if (mode === 'preview') {
    const dir = path.join(HLS_DIR, id);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  const fullOpts = { ...opts, watermarkFile };
  const session = {
    status: 'starting',
    mode,
    startedAt: new Date().toISOString(),
    logTail: [],
    progress: {},
    restarts: 0,
    manualStop: false,
    opts: fullOpts,
    proc: null,
  };
  sessions.set(id, session);

  // YouTube exige pista de audio. Si el usuario pidió audio de cámara, sondeamos:
  // si la cámara no trae audio, inyectamos silencio automáticamente.
  if ((fullOpts.audio || 'camera') === 'camera') {
    const hasAudio = await probeHasAudio(rtspUrl);
    if (!hasAudio) {
      fullOpts.audio = 'silent';
      pushLog(session, 'La cámara no envía audio; se añade pista de silencio (YouTube la requiere).');
    }
  }
  if (session.manualStop) return getStatus(id); // lo detuvieron durante la sonda

  spawnFfmpeg(id, fullOpts, session);
  return getStatus(id);
}

export function stop(id) {
  const s = sessions.get(id);
  if (!s) return { status: 'idle', mode: null };
  s.manualStop = true;
  if (s.restartTimer) clearTimeout(s.restartTimer);
  if (s.proc) {
    try {
      s.proc.kill('SIGKILL');
    } catch {
      /* noop */
    }
  }
  s.status = 'idle';
  s.proc = null;
  return { status: 'idle', mode: null };
}

export function getStatus(id) {
  const s = sessions.get(id);
  if (!s) return { status: 'idle', mode: null, logTail: [], restarts: 0 };
  const tail = s.logTail.slice(-40);
  // Linea sintetica de progreso: prueba visible de que los datos SÍ fluyen.
  if (s.progress && s.progress.outTime && s.proc) {
    tail.push(
      `→ Enviando: ${s.progress.outTime.split('.')[0]} · ${s.progress.bitrate || '?'} · velocidad ${s.progress.speed || '?'}`,
    );
  }
  return {
    status: s.status,
    mode: s.mode,
    startedAt: s.startedAt,
    restarts: s.restarts,
    lastError: s.lastError || null,
    logTail: tail,
  };
}

export function allStatuses() {
  const out = [];
  for (const id of sessions.keys()) out.push({ id, ...getStatus(id) });
  return out;
}

export function stopAll() {
  for (const id of sessions.keys()) stop(id);
}

function throwHttp(status, msg) {
  const e = new Error(msg);
  e.status = status;
  throw e;
}

export const ffmpegBinary = ffmpegPath;
