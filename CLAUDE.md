# CLAUDE.md · GOCAS Live (liveStreaming_Software)

Memoria del proyecto. Léelo al inicio de cada sesión. Producto de GOCAS Automations. Ver el CLAUDE.md raíz de `GOCAS/` para el contexto del negocio y la marca.

## Qué es

Software para que un usuario **transmita su cámara RTSP a YouTube Live con su marca de agua incrustada**. Multi-usuario: cada quien se registra, sube sus marcas y crea transmisiones. El sitio (Vercel) es el **panel de control**; un **puente local** (en la red de la cámara) hace el trabajo de video.

## Arquitectura (decisión firme 21-jul-2026: "puente de vuelta")

Nota histórica: hubo una iteración "web pura, sin puente" que se descartó porque perdía el sentido (no se puede leer RTSP desde Vercel). El modelo actual reintroduce el puente:

```
Cámara RTSP → [ puente local: FFmpeg incrusta la marca ] → RTMP → YouTube Live (con marca quemada)
Panel (Vercel) ── controla el puente vía http://localhost:4000 (mismo PC) ──┘
Panel/datos (login, marcas, transmisiones) ↔ Supabase (auth · Postgres · Storage)
```

- **Vercel no puede** ingerir RTSP ni transcodificar. Por eso el **puente** (Node+FFmpeg, `bridge/`) corre en una PC **en la misma red de la cámara** (las cámaras RTSP viven en la LAN). Hoy = el PC del operador en sitio; futuro = un mini-PC/Raspberry siempre encendido para transmitir sin nadie presente.
- El **panel en Vercel** habla con el puente en `http://localhost:4000` (localhost está exento de bloqueo mixto; el puente responde CORS + **Access-Control-Allow-Private-Network**). Así el operador usa el sitio publicado y su puente local a la vez.
- **NO hay viewer público** dentro del sitio: el live se ve directo en YouTube (con la marca ya incrustada). Se eliminaron `/live/[slug]` y el RPC `get_public_live`.
- La **marca de agua se incrusta con FFmpeg** (se ve en YouTube, no se puede quitar). El tamaño llega a 100% (cubrir todo el ancho). Validado visualmente.

## Seguridad

- **Puente:** escucha SOLO en `127.0.0.1` (loopback) por defecto → nadie en la LAN puede controlarlo aunque sepa la IP; solo la propia máquina. CORS restringido a los orígenes GOCAS (Vercel + localhost). Para un dispositivo dedicado (HOST=0.0.0.0) hay que añadir token — no hacerlo sin eso.
- **Credenciales:** la URL RTSP (con clave) y la clave de YouTube **nunca** se guardan (ni en Supabase ni en disco). Se escriben en el panel al transmitir y viven solo en memoria del puente.
- **Supabase:** RLS por dueño (cada usuario solo lo suyo), verificado por REST. La web usa solo la clave publishable (pública). La service_role jamás va al repo.
- **Coexistencia con Smash Vision:** RTSP es lectura "pull"; el puente solo lee, no reconfigura la cámara. Grabar (Smash) y transmitir (GOCAS) desde la misma cámara conviven. Recomendado: el live use un perfil de stream distinto (sub-stream) al de la grabación, y confirmar el máximo de conexiones RTSP simultáneas del modelo.

## Stack

- **web/**: Next.js 14 · React 18 · TS · `@supabase/ssr` · `hls.js` (preview) · estilos inline + `globals.css` (estética Apple, paleta GOCAS). Toasts propios (`lib/toast.tsx`).
- **bridge/**: Node (ESM) · Express · `ffmpeg-static` (trae su binario). Stateless: recibe todo del panel por request; descarga la marca desde la URL pública de Supabase.

## Estructura

```
liveStreaming_Software/
├── CLAUDE.md · README.md · .gitignore
├── web/                              (se despliega en Vercel)
│   ├── middleware.ts                 (sesión + protege /panel)
│   ├── app/  page.tsx (landing+manual) · login/ · panel/ · layout · globals.css · icon.png
│   ├── components/ ui.tsx · HlsPreview.tsx · panel/{WatermarkManager,LiveForm,LiveCard}.tsx
│   └── lib/  supabase/{client,server,middleware} · data.ts · bridge.ts · toast.tsx · format.ts · tokens.ts · database.types.ts
└── bridge/                           (corre local, en la red de la cámara)
    ├── src/ config.js · ffmpeg.js · server.js
    └── .env.example
```

## Supabase

- Proyecto `iqdskgjmxfirtsncazms` · URL `https://iqdskgjmxfirtsncazms.supabase.co` (org gocas-automation).
- Tablas `lives`, `watermarks` con RLS por dueño. Límites (triggers): 2 lives, 4 marcas. Slug único (trigger). Bucket público `watermarks` (escritura solo carpeta propia `{uid}/`).
- La columna `lives.youtube_video_id` quedó sin uso (era del viewer); inofensiva.
- Auth email+password. `mailer_autoconfirm=false` → los registros exigen confirmar correo. Para onboarding fluido: desactivar "Confirm email" en el dashboard (o configurar SMTP con Resend después).
- Migraciones: `core_schema_lives_watermarks`, `storage_watermarks_bucket`, `security_hardening`, `drop_public_viewer_rpc`.

## Cómo correr

```bash
# 1) Puente (en la PC de la red de la cámara)
cd bridge && npm install && npm start        # http://localhost:4000 (loopback)

# 2) Web (local) — o usa el sitio publicado en Vercel
cd web && npm install && npm run dev          # http://localhost:3000
```
Flujo: registro → subir marcas → crear transmisión (marca+posición+tamaño) → en la tarjeta pegar RTSP + clave de YouTube → "Preview local" (verificar) → "Transmitir a YouTube".

## Despliegue

- **web → Vercel:** ya publicado en `https://website-gocas-live-streaming.vercel.app` (repo `GOCAS-Automations/website_GOCAS_liveStreaming`, Root Directory `web/`, env `NEXT_PUBLIC_SUPABASE_*`). Auto-deploy en cada push a `main`.
- **bridge → local:** el usuario lo corre en sitio. El puente permite el origen del dominio Vercel + `*.vercel.app` + localhost.

## Roadmap / pendientes

- [ ] Probar en el club: Smash grabando + live GOCAS simultáneos, sin conflicto.
- [ ] Empaquetar el puente para no-técnicos (instalador/exe) y, futuro, dispositivo en sitio (mini-PC) con token de auth.
- [ ] Desactivar confirmación de correo o configurar SMTP (Resend).
- [ ] Métricas de audiencia; más protocolos de cámara (iPhone/WebRTC/RTMP).
- [ ] Dominio propio (live.gocas.co).

## Estado actual

- 21-jul-2026: Reintroducido el puente (RTSP→marca incrustada→YouTube) + preview HLS local, controlado desde el panel en Vercel vía localhost (CORS+PNA). Quitado el viewer público. Escala de marca hasta 100%. Sistema de toasts (éxito/error/aviso) abajo-derecha. Puente endurecido a loopback (127.0.0.1). Build limpio; pipeline FFmpeg y CORS/PNA verificados. Web ya en Vercel. Falta: prueba real con cámara del club + YouTube, y decidir confirmación de correo.
