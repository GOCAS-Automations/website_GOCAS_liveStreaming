// GOCAS Live · Agente
// Programa que se instala en el PC de la red de la cámara. NO abre servidor local
// ni recibe conexiones: solo se conecta HACIA AFUERA (a Supabase) cada pocos segundos,
// pregunta qué transmisiones deben estar en vivo, y ejecuta FFmpeg (RTSP -> marca -> YouTube).
// Todo se controla desde el sitio web GOCAS.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import 'dotenv/config';
import { start as startFf, stop as stopFf, allStatuses, stopAll } from './ffmpeg.js';

const SUPABASE_URL = 'https://iqdskgjmxfirtsncazms.supabase.co';
// Clave pública (anon) para pasar el gateway de funciones. No es secreta.
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZHNrZ2pteGZpcnRzbmNhem1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTI0MTksImV4cCI6MjEwMDIyODQxOX0.rqGjIbg2LdYH-4eNZk_mpzyfhdbBy3wCqau6NKPBmCg';
const SYNC_URL = `${SUPABASE_URL}/functions/v1/agent-sync`;
const TOKEN_PATH = path.join(os.homedir(), '.gocas-live-agent');
const POLL_MS = 3000;

const running = new Map(); // liveId -> hash de parámetros

function log(msg) {
  console.log(`  [${new Date().toLocaleTimeString()}] ${msg}`);
}
function paramsHash(d) {
  return JSON.stringify([d.rtspUrl, d.streamKey, d.watermarkUrl, d.position, d.opacity, d.scale, d.margin]);
}

async function resolveToken() {
  if (process.env.AGENT_TOKEN) return process.env.AGENT_TOKEN.trim();
  try {
    const t = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    if (t) return t;
  } catch {
    /* sin token guardado */
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const token = await new Promise((res) =>
    rl.question(
      '\n  Pega el CÓDIGO DE AGENTE (lo generas en el sitio GOCAS, en Dispositivos) y presiona Enter:\n  > ',
      (a) => {
        rl.close();
        res(String(a).trim());
      },
    ),
  );
  if (token) {
    try {
      fs.writeFileSync(TOKEN_PATH, token);
    } catch {
      /* no se pudo guardar; seguirá pidiéndolo */
    }
  }
  return token;
}

let token = '';
let warnedOffline = false;

async function tick() {
  const report = allStatuses().map((s) => ({
    liveId: s.id,
    state: s.status,
    error: s.lastError || null,
    logTail: (s.logTail || []).join('\n'),
  }));

  let data;
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ token, report }),
    });
    data = await res.json().catch(() => ({}));
    warnedOffline = false;
    if (!res.ok) {
      if (res.status === 401) {
        log(`Código de agente inválido. Borra el archivo ${TOKEN_PATH} y reinicia para volver a vincular.`);
      } else {
        log(`El servidor respondió ${res.status}: ${data.error || ''}`);
      }
      return;
    }
  } catch {
    if (!warnedOffline) {
      log('Sin conexión a internet; reintentando…');
      warnedOffline = true;
    }
    return;
  }

  const desired = Array.isArray(data.desired) ? data.desired : [];
  const desiredIds = new Set(desired.map((d) => d.id));

  for (const d of desired) {
    const h = paramsHash(d);
    if (running.get(d.id) !== h) {
      running.set(d.id, h);
      log(`Transmitiendo a YouTube (${d.id.slice(0, 8)})`);
      startFf(d.id, {
        mode: 'youtube',
        rtspUrl: d.rtspUrl,
        streamKey: d.streamKey,
        watermarkUrl: d.watermarkUrl,
        position: d.position,
        opacity: d.opacity,
        scale: d.scale,
        margin: d.margin,
        audio: 'camera',
        videoBitrate: '4500k',
      }).catch((e) => log(`Error al iniciar: ${e.message}`));
    }
  }

  for (const id of [...running.keys()]) {
    if (!desiredIds.has(id)) {
      running.delete(id);
      stopFf(id);
      log(`Deteniendo (${id.slice(0, 8)})`);
    }
  }
}

(async () => {
  console.log('\n  ┌─ GOCAS Live · Agente ─────────────────────────────');
  console.log('  │  Conecta tu cámara con el sitio GOCAS.');
  console.log('  │  Deja esta ventana ABIERTA mientras transmites.');
  console.log('  └───────────────────────────────────────────────────');
  token = await resolveToken();
  if (!token) {
    console.log('\n  No se ingresó código. Cierra y vuelve a abrir para intentar de nuevo.\n');
    return;
  }
  log('Vinculado. Esperando órdenes desde el sitio GOCAS…');
  tick();
  setInterval(tick, POLL_MS);
})();

function shutdown() {
  log('Cerrando y deteniendo transmisiones…');
  stopAll();
  setTimeout(() => process.exit(0), 1000);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
