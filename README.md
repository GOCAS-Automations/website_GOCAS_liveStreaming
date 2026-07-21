# GOCAS Live

Webapp para **enmarcar tu transmisión de YouTube con tu propia marca** y compartirla en un enlace que es tuyo (`/live/tu-nombre`). Cada usuario gestiona sus marcas de agua y sus transmisiones. Producto de **GOCAS Automations**.

## Cómo funciona

Todo corre en **Vercel + Supabase** (sin servidores de video). Tú envías tu cámara a YouTube con el encoder que uses (OBS, hardware, o la app de tu cámara); GOCAS te da la **página con tu marca**, el **enlace propio** y la gestión.

```
Cámara → (OBS / encoder) → YouTube Live → /live/<slug>  (marco GOCAS + tu marca de agua)
Gestión (login · marcas · transmisiones) → Next.js (Vercel) ↔ Supabase (auth · datos · archivos)
```

> La marca de agua se muestra como overlay sobre el marco de tu página GOCAS. No se incrusta en el video de YouTube.

## Stack

Next.js 14 · React 18 · TypeScript · Supabase (Auth · Postgres · Storage).

## Correr en local

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Necesitas las variables de Supabase en `web/.env.local` (ver `web/.env.local.example`).

## Flujo

1. **Regístrate** en `/login` y entra al panel.
2. **Sube tus marcas de agua** (hasta 4). Renómbralas, elimínalas o cámbialas cuando quieras.
3. **Prepara tu live en YouTube** (con tu encoder) y copia el enlace del video.
4. **Crea la transmisión** en GOCAS: pega el enlace de YouTube, elige la marca, su posición y tamaño. Máximo 2 transmisiones por cuenta.
5. **Comparte** `/live/tu-nombre`. Tus espectadores ven el en vivo enmarcado con tu marca; la entrega la hace YouTube (escala a cientos).

## Seguridad

Cada usuario solo ve y gestiona sus propios datos (RLS en Supabase). La web usa únicamente la clave pública (publishable); no hay secretos en el repo.

## Despliegue

- **Vercel:** Root Directory = `web/`. Variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Detalle técnico completo en [`CLAUDE.md`](./CLAUDE.md).
