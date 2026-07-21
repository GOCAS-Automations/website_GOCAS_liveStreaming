import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

// import.meta.url no existe cuando el código va empaquetado (bundle CJS); en ese
// caso caemos a cwd. Da igual: al empaquetar usamos os.tmpdir() para tmp/hls.
let dir;
try {
  dir = path.dirname(fileURLToPath(import.meta.url));
} catch {
  dir = process.cwd();
}

export const ROOT = path.resolve(dir, '..');
// Empaquetado (.exe): el snapshot es de solo lectura → usamos una ruta escribible.
const BASE = process.pkg ? path.join(os.tmpdir(), 'gocas-live') : ROOT;
export const TMP_DIR = path.join(BASE, 'tmp');
export const HLS_DIR = path.join(BASE, 'hls');

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// SEGURIDAD: por defecto el puente escucha SOLO en loopback (127.0.0.1). Así nadie en
// la red local puede controlarlo aunque sepa la IP — solo la propia máquina.
// Para un dispositivo dedicado en sitio (futuro) se puede poner HOST=0.0.0.0, pero
// entonces hay que añadir autenticación (token). No lo hagas sin eso.
export const HOST = process.env.HOST || '127.0.0.1';

// Ingesta RTMP de YouTube (no incluye la clave; esa llega en cada arranque).
export const YOUTUBE_RTMP = process.env.YOUTUBE_RTMP || 'rtmp://a.rtmp.youtube.com/live2';

// Origenes permitidos para controlar el puente. Por seguridad, solo el sitio GOCAS
// (produccion) y localhost. Puedes ampliar con ALLOWED_ORIGINS separado por comas.
const DEFAULT_ORIGINS = [
  'https://website-gocas-live-streaming.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
];
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS
).concat(process.env.ALLOWED_ORIGINS === '*' ? ['*'] : []);

// Permitir cualquier subdominio *.vercel.app (deploys de preview de GOCAS).
export const ALLOW_VERCEL_PREVIEWS = process.env.ALLOW_VERCEL_PREVIEWS !== 'false';

export const MAX_RESTARTS = process.env.MAX_RESTARTS ? Number(process.env.MAX_RESTARTS) : 6;
