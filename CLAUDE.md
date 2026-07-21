# CLAUDE.md · GOCAS Live (liveStreaming_Software)

Memoria del proyecto. Léelo al inicio de cada sesión. Producto de GOCAS Automations. Ver el CLAUDE.md raíz de `GOCAS/` para el negocio y la marca.

## Qué es

SaaS multi-usuario para transmitir una **cámara RTSP a YouTube Live con marca de agua incrustada**. Cualquier usuario se registra y **controla TODO desde el sitio web**; un **agente** instalado en la PC de la red de la cámara hace el trabajo de video.

## Arquitectura FINAL: "agente + nube" (decisión firme 21-jul-2026)

Iteraciones descartadas: reproductor propio → web pura sin puente → puente localhost controlado desde el sitio (falló: el navegador bloquea HTTPS→localhost por PNA/mixed-content, y un .exe no sirve para Mac). Modelo actual:

```
Sitio (Vercel) --"Transmitir"--> Supabase (desired_state='live' + secretos)
                                     ▲            │
   Agente en la red de la cámara ───┘ (cada 3s pregunta a la Edge Function agent-sync)
   ejecuta FFmpeg: RTSP → marca incrustada → YouTube ; reporta estado de vuelta
```

- **El agente solo se conecta HACIA AFUERA** (a Supabase). No abre servidor, no recibe conexiones, no usa localhost → funciona en cualquier red y SO.
- **Todo se controla desde el sitio.** El usuario instala el agente una vez, lo vincula con un token, y se olvida.
- No hay viewer en el sitio: el live se ve en YouTube con la marca ya incrustada.

## Estructura

```
liveStreaming_Software/
├── CLAUDE.md · README.md · .gitignore
├── web/  (Next.js → Vercel)
│   ├── middleware.ts  (sesión + protege /panel)
│   ├── app/  page.tsx (landing+manual) · login/ · panel/ · layout · globals.css · icon.png
│   ├── components/ ui.tsx · panel/{AgentManager,WatermarkManager,LiveForm,LiveCard}.tsx
│   └── lib/ supabase/{client,server,middleware} · data.ts · toast.tsx · format.ts · tokens.ts · database.types.ts
└── bridge/  (el AGENTE — Node+FFmpeg, se empaqueta a .exe)
    ├── src/ agent.js (poller headless) · ffmpeg.js (motor) · config.js
    ├── package.json  (scripts: start, dev, bundle, build:exe)
    └── release/  (gitignored: gocas-agent.exe + ffmpeg.exe + GOCAS-Agente.zip)
```

## Supabase (proyecto `iqdskgjmxfirtsncazms`)

- URL `https://iqdskgjmxfirtsncazms.supabase.co` (org gocas-automation).
- **Tablas** (RLS por dueño): `watermarks`, `agents`, `lives`. Límites por trigger: 2 lives, 4 marcas, 3 agentes. Bucket público `watermarks` (escritura solo carpeta propia).
- **`agents`**: id, user_id, name, token_hash (sha256 del token de dispositivo), last_seen_at.
- **`lives`** (control remoto): agent_id, desired_state ('idle'|'live'), current_state, status_error, log_tail, y los SECRETOS `rtsp_url` + `youtube_key` (se llenan al transmitir y **se borran al detener**).
- **Edge Function `agent-sync`** (verify_jwt=false; auth propia: valida token_hash con service role): recibe {token, report[]}, actualiza estado/heartbeat, devuelve las transmisiones con desired_state='live' de ese agente (con secretos + URL pública de la marca). Migraciones: core_schema, storage_watermarks, security_hardening, drop_public_viewer_rpc, agents_and_remote_control.
- **Auth** email+password, `mailer_autoconfirm=false`. Configurar Site URL = dominio Vercel (Authentication → URL Configuration) para que los correos de confirmación no vayan a localhost.

## El agente (`bridge/`)

- `src/agent.js`: sin servidor HTTP. Resuelve el token (env AGENT_TOKEN → archivo `~/.gocas-live-agent` → pregunta por consola la 1ª vez y lo guarda). Loop cada 3s: reporta estados + recibe desired → reconcilia FFmpeg (start/stop) → repite.
- Empaquetado: `npm run build:exe` = esbuild (bundle CJS, evita el problema ESM de pkg) → pkg node22-win-x64 → `release/gocas-agent.exe`; copia el ffmpeg de `ffmpeg-static` a `release/ffmpeg.exe` (el agente lo busca junto al ejecutable vía `process.pkg`). Para Mac: mismo código, target macos de pkg + ffmpeg de Mac + nota de Gatekeeper (pendiente).
- La clave anon (pública) va embebida en agent.js para pasar el gateway de funciones.

## Seguridad

- Secretos (RTSP con clave, clave YouTube) protegidos por RLS y **borrados al detener**. Es un producto tipo Restream. PENDIENTE: cifrado extremo-a-extremo antes de clientes externos.
- La web usa solo la clave publishable (pública). La service_role vive solo en la Edge Function (inyectada por Supabase).
- Coexistencia con Smash Vision: RTSP es lectura pull; el agente solo lee. Usar sub-stream distinto para el live.

## Cómo correr / probar

```bash
cd web && npm install && npm run dev          # panel local
cd bridge && npm install && npm start          # agente (pide token o usa AGENT_TOKEN)
```
Flujo: registro → Dispositivos: crear agente (copiar token) → abrir agente, pegar token → Marcas: subir logo → Transmisiones: crear → pegar RTSP + clave YouTube + elegir dispositivo → Transmitir.

## Despliegue

- **web → Vercel** (ya en `https://website-gocas-live-streaming.vercel.app`, repo `GOCAS-Automations/website_GOCAS_liveStreaming`, Root=web/, auto-deploy en push a main). Env: `NEXT_PUBLIC_SUPABASE_*` y opcional `NEXT_PUBLIC_AGENT_DOWNLOAD_URL` (URL del instalador).
- **agente → usuario**: descarga `GOCAS-Agente.zip` y lo corre. Falta hospedar el ZIP (Supabase Storage / GitHub Releases) y setear la env de descarga.

## Roadmap / pendientes

- [ ] Hospedar el instalador del agente y setear `NEXT_PUBLIC_AGENT_DOWNLOAD_URL`.
- [ ] Probar en el club con cámara real (+ que Smash Vision grabe en paralelo sin conflicto).
- [ ] Binario del agente para Mac (y auto-arranque / instalar como servicio).
- [ ] Cifrado E2E de secretos; métricas de audiencia; más protocolos (iPhone/WebRTC).

## Estado actual

- 21-jul-2026: Arquitectura agente+nube construida y **validada end-to-end** (arrancar/detener desde la nube con reporte de estado). Build web limpio; `agent-sync` desplegada; agente .exe probado (conecta a la nube, maneja token). Landing/panel actualizados (Dispositivos + control remoto). Pendiente: hospedar instalador + prueba con cámara real.
