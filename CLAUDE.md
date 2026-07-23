# CLAUDE.md · GOCAS Live (liveStreaming_Software)

Memoria del proyecto. Léelo al inicio de cada sesión. Producto de GOCAS Automations. Ver el CLAUDE.md raíz de `GOCAS/` para el negocio y la marca.

## Regla de trabajo (obligatoria)

**Fable (modelo principal) SOLO planifica, orquesta y revisa.** Toda ejecución (escribir/editar código, correr comandos, builds, pruebas, commits) la realizan subagentes: **opus** para tareas complejas (motor de video, arquitectura, debugging difícil) y **sonnet** para tareas mecánicas (scaffolding, docs, builds, commits). Fable solo toca directamente archivos de gobernanza (este CLAUDE.md, memoria).

## Qué es

**App de escritorio** (Electron, Windows primero → macOS después) para transmitir una **cámara RTSP a YouTube Live con marca de agua incrustada**. Sin usuarios, sin nube: cada equipo guarda sus transmisiones y marcas localmente. Estilo iPhone/iOS moderno-minimalista con paleta GOCAS.

Historia: fue webapp (Vercel+Supabase) con agente remoto; el 22-jul-2026 Cesar pivotó a app de escritorio y **borró los proyectos de Vercel y Supabase** (ya no existen). El repo GitHub `GOCAS-Automations/website_GOCAS_liveStreaming` se conserva como repo del proyecto.

## Reglas de producto (decisiones firmes)

- **Logo GOCAS SIEMPRE incrustado** en todo live: `assets/gocas-watermark.png`, 10% del ancho, opacidad 0.75, abajo-izquierda, margen 16px. La UI lo avisa. La marca del usuario es adicional y configurable.
- **"En vivo" solo se declara con confirmación real**: sonda de cámara OK → FFmpeg corriendo → datos fluyendo a YouTube → 8s de flujo sostenido. Cada fallo marca su paso en el timeline (Cámara → Procesador → YouTube → En vivo) con mensaje amigable en español (`classifyError`).
- **Sonda RTSP previa obligatoria** (`probeCamera`): IP sin RTSP, credenciales malas, ruta inexistente o timeout se detectan ANTES de transmitir, con mensaje claro. También detecta si la cámara trae audio; si no, se **inyecta silencio** (YouTube lo exige — causa clásica del "no data").
- **Preview local HLS** con las marcas incrustadas antes de salir en vivo.
- **Fallo rápido**: si nunca llegaron datos, no se reintenta (error inmediato). Si el stream cayó a mitad, hasta 4 reintentos con backoff.
- Clave de YouTube y URL RTSP se guardan **localmente** en el equipo (JSON en userData) — decisión consciente, es una app local tipo OBS.

## Red / caso de uso clave (respuestas validadas)

- **Transmitir con internet del celular**: PC con 2 conexiones — ethernet a la red de la cámara (RTSP es tráfico local, no gasta internet) + WiFi al hotspot (por ahí sale el RTMP a YouTube). Windows enruta solo; si la red local también tiene internet puede requerir ajustar métrica/gateway. Documentado en la pestaña Ayuda de la app.
- Cámara WiFi + PC en el mismo hotspot también funciona (ojo: algunos hotspots aíslan clientes entre sí).
- Coexistencia con Smash Vision: RTSP es lectura pull, conviven; usar sub-stream para el live.

## Estructura

```
liveStreaming_Software/
├── CLAUDE.md · README.md · .gitignore
└── app/                        (Electron; CommonJS, sin frameworks en renderer)
    ├── package.json            (electron 37 · electron-builder 25 · ffmpeg-static · hls.js; scripts: start, dist)
    ├── src/
    │   ├── main.js             (ventana 1140x780 crema, IPC completo, assets via isPackaged→resourcesPath)
    │   ├── preload.js          (contextBridge → window.gocas)
    │   ├── engine.js           (motor: probeCamera, classifyError ES, filter doble marca, progreso -progress pipe:2, confirmación live 8s, reintentos)
    │   ├── store.js            (JSON en userData: lives + watermarks; archivos de marca en userData/watermarks)
    │   └── server.js           (mini HTTP 127.0.0.1:aleatorio para /hls y /wm — solo loopback)
    ├── renderer/               (index.html + styles.css + app.js + vendor/hls.min.js)
    └── assets/                 (icon.png, gocas-watermark.png, logos svg)
```

## Detalles técnicos que cuestan descubrir

- `ffmpeg-static` empaquetado: `asarUnpack` en build config + reemplazo `app.asar`→`app.asar.unpacked` en engine.js. Assets para FFmpeg (logo GOCAS) van por `extraResources` → `process.resourcesPath/assets` cuando `app.isPackaged`.
- En este entorno de desarrollo la env `ELECTRON_RUN_AS_NODE=1` puede estar seteada y rompe `electron .` — limpiarla antes de lanzar o compilar.
- El renderer corre en file:// y consume HLS/imágenes de `http://127.0.0.1:<puerto aleatorio>` (mini servidor, solo loopback).
- pkg/esbuild ya NO se usan (eran del agente anterior); electron-builder hace todo.
- El instalador NSIS un-clic sale en `app/dist/GOCAS-Live-Setup-<version>.exe` (~110 MB). Sin firma de código → SmartScreen avisa ("Más información → Ejecutar de todas formas").

## Cómo correr / construir

```bash
cd app && npm install
npm start        # desarrollo (ventana Electron)
npm run dist     # instalador NSIS en app/dist/
```

## Distribución

- **GitHub Releases** del repo `GOCAS-Automations/website_GOCAS_liveStreaming`: tag `v<version>`, asset `GOCAS-Live-Setup-<version>.exe`. El usuario descarga, doble clic, listo.
- macOS: mismo código, `electron-builder --mac` (requiere construir en Mac o CI; pendiente cuando haya usuario Mac). **iOS (iPhone) NO es esto** — sería una app móvil aparte.

## Roadmap / pendientes

- [ ] Prueba real en el club (cámara + hotspot + Smash Vision en paralelo).
- [ ] Auto-update (electron-updater + GitHub Releases).
- [ ] Build macOS. Firma de código (elimina aviso SmartScreen) cuando haya presupuesto.
- [ ] Indicador de red en la app (por qué interfaz sale el live) — idea para reforzar el caso hotspot.

## Estado actual

- 22-jul-2026: **Pivot a app de escritorio completado.** App Electron construida por agentes (opus: motor+main+UI; sonnet: scaffold+build).
- 23-jul-2026 (tras 1ª prueba real de Cesar): **v1.0.0 endurecida.** Fixes: timestamps de cámara normalizados (`+genpts` + `aresample=async=1` — la cámara real enviaba DTS de audio hacia atrás, colgaba el preview HLS y contribuía a cortes en YouTube); `-rw_timeout` 15s para cámara muerta; 30 reintentos con backoff y contador que se resetea tras 60s estable; `code=0` = YouTube cerró la transmisión (detectado y avisado, sin reintentos); timeline corrige pasos en caída/reconexión (bug de checks verdes con error); player HLS con autorecuperación (5 ciclos + botón Reintentar); pestaña **Manuales** (5 guías HTML+PDF generadas con printToPDF, incl. "Transmitir con el internet del celular" súper explícita; `npm run manuals` las regenera); instalador NSIS asistido con carpeta elegible (116 MB). Commit `010604a` local. Pendiente: push (GCM pide login interactivo), release v1.0.0 en GitHub, re-prueba de Cesar con cámara real.
