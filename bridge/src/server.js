import express from 'express';
import { PORT, HOST, HLS_DIR, ALLOWED_ORIGINS, ALLOW_VERCEL_PREVIEWS } from './config.js';
import { start, stop, getStatus, stopAll, ffmpegBinary } from './ffmpeg.js';

const app = express();
app.use(express.json({ limit: '1mb' }));

// ---- CORS + Private Network Access (permite que el sitio HTTPS controle este localhost) ----
function originAllowed(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes('*')) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (ALLOW_VERCEL_PREVIEWS && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  return false;
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Chrome Private Network Access: sitio publico -> localhost
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get(['/health', '/api/health'], (_req, res) => {
  res.json({ ok: true, ffmpeg: ffmpegBinary, service: 'gocas-live-bridge', version: '0.2.0' });
});

app.post('/api/streams/:id/start', async (req, res) => {
  const b = req.body || {};
  const mode = b.mode === 'youtube' ? 'youtube' : 'preview';
  try {
    const status = await start(String(req.params.id), {
      mode,
      rtspUrl: String(b.rtspUrl || '').trim(),
      streamKey: String(b.streamKey || '').trim(),
      watermarkUrl: b.watermarkUrl ? String(b.watermarkUrl) : null,
      position: b.position,
      opacity: b.opacity,
      scale: b.scale,
      margin: b.margin,
      audio: b.audio,
      videoBitrate: b.videoBitrate,
    });
    res.json({ status });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/streams/:id/stop', (req, res) => {
  res.json({ status: stop(String(req.params.id)) });
});

app.get('/api/streams/:id/status', (req, res) => {
  res.json({ status: getStatus(String(req.params.id)) });
});

// HLS del preview local
app.use(
  '/hls',
  (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(HLS_DIR),
);

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  GOCAS Live · puente en http://localhost:${PORT} (escuchando en ${HOST})`);
  console.log(`  FFmpeg: ${ffmpegBinary}`);
  console.log(`  Deja esta ventana abierta mientras transmites.\n`);
});

function shutdown() {
  console.log('\n  Cerrando · deteniendo transmisiones...');
  stopAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
