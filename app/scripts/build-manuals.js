// scripts/build-manuals.js · Genera el PDF de cada manual a partir de su HTML.
// Corre DENTRO de Electron (necesita BrowserWindow + webContents.printToPDF), no
// con Node a secas. Por eso el script npm "manuals" lo lanza con `electron`, no
// con `node`. Si la variable de entorno ELECTRON_RUN_AS_NODE está activa, Electron
// arranca como si fuera Node puro (sin `app` ni `BrowserWindow`), así que hay que
// limpiarla ANTES de invocar este script (ver README del comando `npm run manuals`).
//
// Uso: npm run manuals

'use strict';

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const MANUALES_DIR = path.join(__dirname, '..', 'manuales');

// Lee el manifest de manuales (mismo archivo que consume la app en tiempo de
// ejecución) para no duplicar la lista de manuales en dos lugares.
function readManifest() {
  const raw = fs.readFileSync(path.join(MANUALES_DIR, 'manifest.json'), 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.manuales) ? data.manuales : [];
}

// Carga un HTML en la ventana oculta y lo imprime a PDF junto al HTML original,
// respetando el tamaño de página A4 definido por CSS (@page) en cada manual.
async function renderPdf(win, htmlFile, pdfFile) {
  const htmlPath = path.join(MANUALES_DIR, htmlFile);
  const pdfPath = path.join(MANUALES_DIR, pdfFile);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`No existe el HTML de origen: ${htmlFile}`);
  }

  await win.loadFile(htmlPath);
  // Pequeña espera para que fuentes/estilos terminen de aplicarse antes de imprimir.
  await new Promise((resolve) => setTimeout(resolve, 300));

  const buffer = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    preferCSSPageSize: true, // respeta el @page (tamaño + márgenes) de cada manual
    landscape: false,
  });

  fs.writeFileSync(pdfPath, buffer);
  const kb = (buffer.length / 1024).toFixed(0);
  console.log(`OK   ${pdfFile}  (${kb} KB)`);
}

async function main() {
  const list = readManifest();
  if (!list.length) {
    console.error('El manifest de manuales está vacío; no hay nada que generar.');
    app.exit(1);
    return;
  }

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: false },
  });

  let ok = 0;
  let fail = 0;

  for (const m of list) {
    if (!m || !m.html || !m.pdf) continue;
    try {
      await renderPdf(win, m.html, m.pdf);
      ok++;
    } catch (err) {
      fail++;
      console.error(`ERROR generando ${m.pdf || '(sin nombre)'}:`, err.message);
    }
  }

  win.destroy();
  console.log(`\nListo: ${ok} PDF generado(s), ${fail} con error.`);
  app.exit(fail > 0 ? 1 : 0);
}

app.whenReady().then(main).catch((err) => {
  console.error('Fallo inesperado generando los manuales:', err);
  app.exit(1);
});
