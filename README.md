# GOCAS Live

Transmite tu **cámara RTSP a YouTube Live con tu marca de agua incrustada**, controlando **todo desde el sitio web**. Un pequeño **agente** que instalas una vez en la red de tu cámara hace el trabajo. Producto de **GOCAS Automations**.

## Cómo funciona

```
Sitio web (Vercel) ── "Transmitir" ──► Supabase ◄── el agente pregunta cada 3s
                                                     y ejecuta FFmpeg → YouTube
```

- El **sitio** (Next.js) es el control total: login, marcas, dispositivos, transmisiones.
- El **agente** (`bridge/`, Node + FFmpeg empaquetado en .exe) se instala en la PC de la red de la cámara. Se conecta **solo hacia afuera**: no abre puertos, no usa localhost, funciona en cualquier red y SO. Trae su propio FFmpeg.
- El live se ve en **YouTube** con la marca ya incrustada.

## Flujo para el usuario

1. **Regístrate** y sube tu marca de agua (hasta 4).
2. **Dispositivos → Vincular un dispositivo:** el sitio te da un código.
3. **Instala el agente** en la PC de la red de la cámara (descomprime, doble clic) y pega el código la primera vez.
4. **Crea una transmisión** (nombre + marca).
5. **Transmitir:** elige el dispositivo, pega la URL RTSP y la clave de tu YouTube Live, y un clic. Tu cámara sale en vivo con tu marca. Detienes desde el sitio.

## Correr en desarrollo

```bash
cd web && npm install && npm run dev       # panel (necesita web/.env.local con las claves de Supabase)
cd bridge && npm install && npm start       # agente (pide el token, o usa AGENT_TOKEN=...)
```

Empaquetar el agente a .exe: `cd bridge && npm run build:exe` → `release/gocas-agent.exe` (+ `ffmpeg.exe`).

## Seguridad

- Cada usuario solo ve y controla lo suyo (RLS en Supabase).
- La URL RTSP y la clave de YouTube se guardan mientras transmites y **se borran al detener**.
- El sitio usa solo la clave pública; la clave secreta vive solo en la función de la nube.

Detalle técnico completo en [`CLAUDE.md`](./CLAUDE.md).
