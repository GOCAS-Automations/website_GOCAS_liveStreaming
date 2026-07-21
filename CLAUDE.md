# CLAUDE.md · GOCAS Live (liveStreaming_Software)

Memoria del proyecto. Léelo al inicio de cada sesión de este proyecto. Producto de GOCAS Automations. Ver el CLAUDE.md raíz de `GOCAS/` para el contexto del negocio y la marca.

## Qué es

Webapp multi-usuario para **gestionar transmisiones en vivo enmarcadas con tu marca**. Cada usuario se registra, sube sus marcas de agua y crea transmisiones; cada live vive en su propia URL `/live/<slug>` que embebe un video en vivo de YouTube dentro de un marco GOCAS, con la **marca de agua superpuesta**. Visión: métricas, más protocolos de cámara.

## Arquitectura — WEB PURA (decisión 21-jul-2026)

Todo corre en Vercel + Supabase. **No hay servidor de video / FFmpeg / puente RTSP** (se descartó por decisión del cliente: "web pura, sin puente"). Implicaciones:

- La **marca de agua es un overlay CSS** sobre el marco del viewer (encima del iframe de YouTube). NO se incrusta en el video de YouTube, y no sobrevive al fullscreen del reproductor de YouTube. Es branding del marco GOCAS.
- La **ingesta a YouTube la hace el usuario por fuera** (OBS, encoder de hardware, o la app de su cámara). GOCAS no transmite ni transcodifica.
- Si en el futuro se quiere marca de agua incrustada real o puente RTSP→YouTube, hace falta un servicio con FFmpeg en un VPS (se construyó un `bridge/` en una iteración previa y se eliminó; el patrón queda documentado en el historial de la conversación).

```
Cámara → (OBS/encoder del usuario) → YouTube Live → embed en /live/<slug> (marco GOCAS + overlay de marca)
Gestión (login, lives, marcas) → Next.js en Vercel ↔ Supabase (auth, Postgres, Storage)
```

## Stack

Next.js 14 · React 18 · TypeScript · `@supabase/ssr` + `@supabase/supabase-js` · estilos inline + `app/globals.css`. Sin Tailwind. Sin dependencias de video.

## Estructura

```
liveStreaming_Software/
├── CLAUDE.md · README.md · .gitignore
└── web/                         (todo el producto; se despliega en Vercel)
    ├── middleware.ts            (refresca sesión + protege /panel)
    ├── app/
    │   ├── page.tsx             (landing + manual de 4 pasos, nav según sesión)
    │   ├── login/page.tsx       (login/registro, Supabase Auth)
    │   ├── panel/page.tsx       (privado: marcas + transmisiones)
    │   ├── live/[slug]/page.tsx (público: embed YouTube + overlay, vía RPC)
    │   ├── layout.tsx · globals.css · icon.png
    ├── components/
    │   ├── ui.tsx               (Wordmark, WatermarkFrame, wmOverlayStyle)
    │   └── panel/               (WatermarkManager, LiveForm, LiveCard)
    └── lib/
        ├── supabase/            (client.ts, server.ts, middleware.ts)
        ├── data.ts              (CRUD lives + watermarks, límites)
        ├── format.ts            (slugify, extractYouTubeId)
        ├── tokens.ts            (paleta, posiciones)
        └── database.types.ts    (tipos generados de Supabase)
```

## Supabase

- **Proyecto:** `iqdskgjmxfirtsncazms` · URL `https://iqdskgjmxfirtsncazms.supabase.co` (org GOCAS `gocas-automation`).
- **Tablas** (`public`): `lives`, `watermarks`. Todo con **RLS: cada usuario solo ve/gestiona lo suyo** (`auth.uid() = user_id`).
- **Límites por usuario** (triggers): máx **2 lives**, máx **4 marcas de agua**. Probados y funcionando.
- **Slug único global** (trigger `ensure_unique_slug`, auto-sufijo en colisión).
- **Storage:** bucket público `watermarks`. Escritura solo en la carpeta propia `{user_id}/...` (políticas por dueño). Lectura por URL pública (los buckets públicos sirven sin política de SELECT).
- **RPC público** `get_public_live(p_slug)`: SECURITY DEFINER, ejecutable por `anon`; devuelve SOLO campos públicos del live + datos de overlay. Es lo que usa el viewer. (Los 2 warnings de advisors que quedan son por esta función y son **intencionales**.)
- **Migraciones aplicadas:** `core_schema_lives_watermarks`, `storage_watermarks_bucket`, `security_hardening`.
- **Auth:** email + contraseña. OJO: `mailer_autoconfirm = false` → los registros **requieren confirmar el correo**. Para onboarding fluido sin SMTP, desactivar "Confirm email" en el dashboard (Authentication → Sign In / Providers → Email).

## Seguridad — reglas

- Nunca exponer la `service_role` key ni ponerla en el repo. La web usa solo la clave **publishable** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), que es pública por diseño y está protegida por RLS.
- La seguridad de los datos vive en la BD (RLS + triggers + RPC de campos públicos), no en el cliente. Verificado por REST: anon ve 0 filas ajenas, límites bloquean, RPC solo público.

## Variables de entorno (web)

```
NEXT_PUBLIC_SUPABASE_URL=https://iqdskgjmxfirtsncazms.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   (pública)
```
Local: en `web/.env.local` (gitignored, ya creado). Producción: en Vercel → Environment Variables.

## Cómo correr en local

```bash
cd web && npm install && npm run dev     # http://localhost:3000
```
Regístrate en `/login`, sube marcas y crea transmisiones en `/panel`, comparte `/live/<slug>`.

## Despliegue (Vercel)

- Root del proyecto en Vercel = **`web/`** (monorepo: setear Root Directory).
- Env vars: las dos `NEXT_PUBLIC_SUPABASE_*`.
- El repo es de GOCAS: confirmar con Cesar antes de `git push` a `main`.
- Repo destino: `github.com/GOCAS-Automations/website_GOCAS_liveStreaming`.

## Roadmap / pendientes

- [ ] Desactivar confirmación de correo (o configurar SMTP) para onboarding fluido.
- [ ] Métricas de audiencia (Supabase) — pedido del cliente para "después".
- [ ] Más protocolos de cámara (iPhone/WebRTC/RTMP) — implicaría reintroducir un servicio de video (VPS), no cabe en Vercel.
- [ ] Marca de agua incrustada real (requiere FFmpeg en VPS) — hoy es overlay CSS.
- [ ] Dominio propio, correo de la marca, y perfeccionar SEO/share cards del viewer.

## Estado actual

- 21-jul-2026: Reescritura a web-pura + Supabase. Auth (login/registro), gestión de marcas (subir/ver/renombrar/eliminar, máx 4), transmisiones por usuario (máx 2), viewer público con overlay. RLS + límites + RPC verificados por REST. Rediseño estilo Apple. Build limpio. Pendiente: subir a GitHub y desplegar en Vercel.
