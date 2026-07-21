import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Wordmark, wmOverlayStyle } from '@/components/ui';
import type { WatermarkPosition } from '@/lib/format';

export const dynamic = 'force-dynamic';

function wmUrl(path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/watermarks/${path}`;
}

export default async function LivePage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_public_live', { p_slug: params.slug });
  const live = data?.[0];

  return (
    <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass">
        <div className="container row between" style={{ height: 64 }}>
          <Wordmark />
          <Link href="/" className="btn btn-quiet btn-sm">
            Inicio
          </Link>
        </div>
      </header>

      <section className="container" style={{ padding: '32px 24px 64px', flex: 1, width: '100%' }}>
        {!live ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
            <h1 style={{ fontSize: 26, marginBottom: 10 }}>Transmisión no encontrada</h1>
            <p className="muted" style={{ marginBottom: 24 }}>
              El enlace <span className="mono">/live/{params.slug}</span> no existe.
            </p>
            <Link href="/" className="btn btn-primary">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 14, gap: 12 }}>
              {live.youtube_video_id ? (
                <span className="badge badge-live">
                  <span className="dot dot-pulse" /> En vivo
                </span>
              ) : (
                <span className="badge">Próximamente</span>
              )}
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                /live/{live.slug}
              </span>
            </div>

            <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', marginBottom: 20 }}>{live.title}</h1>

            <div className="stage" style={{ boxShadow: 'var(--shadow-lg)' }}>
              {live.youtube_video_id ? (
                <>
                  <iframe
                    src={`https://www.youtube.com/embed/${live.youtube_video_id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                    title={live.title}
                    allow="accelerometer; autoplay; encrypted-media; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  {wmUrl(live.wm_path) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={wmUrl(live.wm_path)!}
                      alt=""
                      style={wmOverlayStyle(
                        live.wm_position as WatermarkPosition,
                        live.wm_scale,
                        live.wm_opacity,
                        live.wm_margin,
                      )}
                    />
                  ) : null}
                </>
              ) : (
                <div className="stage-empty">
                  <span className="badge">
                    <span className="dot dot-pulse" /> Aún sin señal
                  </span>
                  <p style={{ maxWidth: 380 }}>
                    Esta transmisión todavía no tiene un video de YouTube asociado.
                  </p>
                </div>
              )}
            </div>

            {live.description ? (
              <p className="lead" style={{ marginTop: 22, maxWidth: 720 }}>
                {live.description}
              </p>
            ) : null}

            <p className="mono" style={{ marginTop: 26, fontSize: 12, color: 'var(--muted)' }}>
              Transmisión enmarcada por GOCAS Live
            </p>
          </>
        )}
      </section>
    </main>
  );
}
