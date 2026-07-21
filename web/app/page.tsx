import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Wordmark } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    n: '01',
    title: 'Crea tu cuenta y sube tu marca',
    body: 'Regístrate y sube tu logo. Hasta 4 marcas de agua listas para elegir en cada transmisión.',
  },
  {
    n: '02',
    title: 'Instala y vincula tu dispositivo',
    body: 'Instala el agente GOCAS en la PC que está en la red de tu cámara y pégale el código que genera el sitio. Se conecta solo, sin configurar nada más.',
  },
  {
    n: '03',
    title: 'Configura la transmisión',
    body: 'Ponle nombre y elige tu marca de agua, posición y tamaño. Al transmitir pegas la URL RTSP de la cámara y la clave de tu YouTube Live.',
  },
  {
    n: '04',
    title: 'Transmite desde el sitio',
    body: 'Un clic y tu cámara sale en vivo en YouTube con tu marca incrustada. Todo se controla desde aquí; el agente hace el trabajo.',
  },
];

const FEATURES = [
  { t: 'Todo desde el sitio', d: 'Controlas tus transmisiones desde el navegador, sin abrir nada más.' },
  { t: 'Marca de agua incrustada', d: 'Tu logo va quemado en el video: se ve en YouTube y no se puede quitar.' },
  { t: 'Instala una vez', d: 'El agente en sitio se conecta solo y funciona en cualquier red.' },
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
          Lleva tu cámara RTSP a YouTube en vivo con tu propia marca de agua incrustada. Sin
          complicaciones, listo para cientos de espectadores.
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
