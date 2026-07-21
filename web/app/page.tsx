import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Wordmark } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    n: '01',
    title: 'Crea tu cuenta y tu marca',
    body: 'Regístrate y sube tu logo. Hasta 4 marcas de agua listas para elegir en cada transmisión.',
  },
  {
    n: '02',
    title: 'Prepara tu live en YouTube',
    body: 'Crea la transmisión en YouTube y envía tu cámara con el encoder que uses (OBS, hardware o la app de tu cámara). Copia el enlace del video.',
  },
  {
    n: '03',
    title: 'Crea la transmisión en GOCAS',
    body: 'Pega el enlace de YouTube, elige tu marca de agua, posición y tamaño. Cada live nace con su propia URL: /live/tu-nombre.',
  },
  {
    n: '04',
    title: 'Comparte tu enlace',
    body: 'Envía tu enlace /live/… Tus espectadores ven el en vivo enmarcado con tu marca. Escala a cientos de personas sin esfuerzo.',
  },
];

const FEATURES = [
  { t: 'Tu marca, no la de otro', d: 'Tu logo sobre el marco de cada transmisión.' },
  { t: 'Tu propio enlace', d: 'Cada live vive en /live/tu-nombre, listo para compartir.' },
  { t: 'Escala tranquila', d: 'La entrega la hace YouTube: cientos de espectadores sin sudar.' },
];

export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <main>
      {/* Header */}
      <header className="glass">
        <div className="container row between" style={{ height: 66 }}>
          <Wordmark />
          <div className="row" style={{ gap: 10 }}>
            <Link href="/#como" className="btn btn-quiet btn-sm">
              Cómo funciona
            </Link>
            {authed ? (
              <Link href="/panel" className="btn btn-primary btn-sm">
                Abrir panel
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-quiet btn-sm">
                  Ingresar
                </Link>
                <Link href="/login" className="btn btn-primary btn-sm">
                  Crear cuenta
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container" style={{ padding: '96px 24px 64px', textAlign: 'center' }}>
        <p className="kicker" style={{ marginBottom: 22 }}>
          Transmisión en vivo · por GOCAS
        </p>
        <h1 className="display" style={{ maxWidth: 860, margin: '0 auto' }}>
          Tu cámara en vivo,
          <br />
          con tu marca.
        </h1>
        <p className="lead" style={{ maxWidth: 560, margin: '26px auto 0' }}>
          Enmarca tu transmisión de YouTube con tu propia marca de agua y compártela en un enlace
          que es tuyo. Simple, elegante, listo para cientos de espectadores.
        </p>
        <div className="row" style={{ marginTop: 36, justifyContent: 'center' }}>
          <Link href={authed ? '/panel' : '/login'} className="btn btn-primary">
            {authed ? 'Abrir panel' : 'Empezar gratis'}
          </Link>
          <Link href="/#como" className="btn btn-ghost">
            Ver cómo funciona
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container" style={{ paddingBottom: 40 }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
        >
          {FEATURES.map((f) => (
            <div key={f.t} className="card-flat" style={{ background: 'transparent', border: 'none' }}>
              <h3 style={{ fontSize: 19, marginBottom: 6 }}>{f.t}</h3>
              <p className="muted" style={{ fontSize: 15 }}>
                {f.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Manual */}
      <section
        id="como"
        style={{ background: 'var(--surface-2)', padding: '80px 0', scrollMarginTop: 66 }}
      >
        <div className="container">
          <p className="kicker" style={{ marginBottom: 12 }}>
            Guía rápida
          </p>
          <h2 className="h2" style={{ marginBottom: 44 }}>
            Empieza en 4 pasos
          </h2>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
          >
            {STEPS.map((s) => (
              <div key={s.n} className="card">
                <span
                  className="mono"
                  style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.1em' }}
                >
                  {s.n}
                </span>
                <h3 style={{ fontSize: 18, margin: '14px 0 8px' }}>{s.title}</h3>
                <p className="muted" style={{ fontSize: 14.5 }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 40, justifyContent: 'center' }}>
            <Link href={authed ? '/panel' : '/login'} className="btn btn-olive">
              {authed ? 'Ir al panel' : 'Crear mi cuenta'}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '32px 0' }}>
        <div className="container row between">
          <Wordmark sub="automations" />
          <p className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
            Cali · Colombia
          </p>
        </div>
      </footer>
    </main>
  );
}
