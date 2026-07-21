# GOCAS Live

Transmite tu **cámara RTSP a YouTube Live con tu marca de agua incrustada**. Cada usuario gestiona sus marcas y sus transmisiones desde el panel; un pequeño **puente** corre en sitio (en la red de la cámara) y hace el video. Producto de **GOCAS Automations**.

## Cómo funciona

```
Cámara RTSP → [ puente local: FFmpeg incrusta la marca ] → YouTube Live (con tu marca quemada)
Panel (Vercel) ── controla el puente en http://localhost:4000 ──┘
Login · marcas · transmisiones ↔ Supabase
```

- El **panel** (Next.js, en Vercel) es el control: login, marcas de agua, transmisiones.
- El **puente** (Node + FFmpeg, carpeta `bridge/`) corre en una PC **en la misma red de la cámara** (las cámaras RTSP no son accesibles desde internet). Trae su propio FFmpeg; no instalas nada.
- El live se ve **directo en YouTube** con la marca ya incrustada (no hay reproductor dentro del sitio).

## Correr

**1) El puente** (en la PC de la red de la cámara):

```bash
cd bridge
npm install
npm start           # queda en http://localhost:4000 (solo loopback)
```

**2) El panel:** usa el sitio publicado, o localmente:

```bash
cd web
npm install
npm run dev         # http://localhost:3000
```

El panel necesita las variables de Supabase (`web/.env.local`, ver `web/.env.local.example`).

## Flujo

1. **Regístrate** y entra al panel.
2. **Sube tus marcas de agua** (hasta 4).
3. **Crea una transmisión**: nombre + marca, posición y tamaño (hasta 100% del ancho). Máx 2 por cuenta.
4. Abre el **puente** en la PC en sitio. En la tarjeta de la transmisión pega la **URL RTSP** de la cámara y la **clave de retransmisión** de tu YouTube Live.
5. **Preview local** para verificar, luego **Transmitir a YouTube**. Listo: tu cámara sale en vivo con tu marca.

## Seguridad

- El puente escucha **solo en `127.0.0.1`**: nadie más en la red puede controlarlo. CORS restringido al sitio GOCAS.
- La URL RTSP y la clave de YouTube **no se guardan**: viven en memoria mientras transmites.
- En Supabase cada usuario solo ve y gestiona lo suyo (RLS).

## Coexistencia con otras grabaciones

El puente solo **lee** el RTSP; no reconfigura la cámara. Grabar y transmitir desde la misma cámara conviven. Recomendado: usa un perfil de stream distinto (sub-stream) para el live.

Detalle técnico completo en [`CLAUDE.md`](./CLAUDE.md).
