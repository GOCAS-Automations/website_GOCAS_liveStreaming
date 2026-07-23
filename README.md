# GOCAS Live

App de escritorio para transmitir tu **cámara RTSP a YouTube Live con tu marca de agua incrustada**. Sin cuentas, sin configuración de servidores: instalas, pegas la URL de tu cámara y la clave de YouTube, y sales en vivo. Producto de **GOCAS Automations**.

## Descarga

Enlace a [Releases](https://github.com/GOCAS-Automations/website_GOCAS_liveStreaming/releases/latest) → descarga `GOCAS-Live-Setup-*.exe` → doble clic.

> **Nota SmartScreen:** Windows puede mostrar un aviso porque la app no tiene firma de código (normal). Elige **"Más información" → "Ejecutar de todas formas"**.

## Qué hace

- Sonda de cámara con diagnóstico claro (te avisa si esa IP no tiene RTSP, credenciales malas, etc.).
- Preview local con las marcas antes de salir en vivo.
- "En vivo" solo se confirma cuando YouTube está recibiendo datos de forma estable.
- Marcas de agua propias (posición, tamaño, opacidad).
- Todos los lives llevan el logo GOCAS (pequeño, 75% opacidad, abajo-izquierda).
- Si la cámara no trae audio, se añade silencio automáticamente (YouTube lo exige).

## Transmitir con el internet del celular

PC por ethernet a la red de la cámara + WiFi al hotspot del celular: leer la cámara es tráfico local y el live sale por el hotspot.

## Desarrollo

```bash
cd app && npm install && npm start
```

Instalador: `npm run dist` → `app/dist/`.

## Nota técnica

Electron + FFmpeg (`ffmpeg-static`). Datos locales en el equipo. Detalle completo en [`CLAUDE.md`](./CLAUDE.md).
