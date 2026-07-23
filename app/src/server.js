// server.js · Mini servidor estático local (127.0.0.1) de GOCAS Live
// Sirve dos cosas al renderer: los segmentos/playlist HLS del preview (/hls/*)
// y los archivos de marcas de agua (/wm/*). Escucha solo en loopback y en un
// puerto efímero para no chocar con otros procesos.

const http = require('http');
const fs = require('fs');
const path = require('path');

// Tipos MIME que sabemos servir.
const MIME = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Arranca el servidor y resuelve con { server, port } (puerto real asignado).
function startServer({ hlsRoot, wmDir }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '').split('?')[0]);

        // Enruta a la base según el prefijo.
        let base = null;
        let rel = null;
        if (urlPath.startsWith('/hls/')) {
          base = hlsRoot;
          rel = urlPath.slice('/hls/'.length);
        } else if (urlPath.startsWith('/wm/')) {
          base = wmDir;
          rel = urlPath.slice('/wm/'.length);
        }
        if (!base) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        // Anti-traversal: la ruta resuelta debe quedar dentro de la base.
        const baseResolved = path.resolve(base);
        const resolved = path.resolve(path.join(base, rel));
        if (resolved !== baseResolved && !resolved.startsWith(baseResolved + path.sep)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        // Debe existir y ser un archivo.
        let stat;
        try { stat = fs.statSync(resolved); } catch (e) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        if (!stat.isFile()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(resolved).pipe(res);
      } catch (e) {
        res.writeHead(500);
        res.end('Error');
      }
    });

    server.on('error', reject);
    // Puerto 0 = el SO asigna uno libre; solo loopback.
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

module.exports = { startServer };
