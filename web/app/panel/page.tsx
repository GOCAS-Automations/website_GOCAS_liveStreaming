'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { listLives, listWatermarks, MAX_LIVES, type Live, type Watermark } from '@/lib/data';
import { bridge, BRIDGE_URL } from '@/lib/bridge';
import { Wordmark } from '@/components/ui';
import WatermarkManager from '@/components/panel/WatermarkManager';
import LiveForm from '@/components/panel/LiveForm';
import LiveCard from '@/components/panel/LiveCard';

export default function PanelPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [lives, setLives] = useState<Live[] | null>(null);
  const [watermarks, setWatermarks] = useState<Watermark[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Live | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [lv, wm] = await Promise.all([listLives(), listWatermarks()]);
      setLives(lv);
      setWatermarks(wm);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando datos.');
      setLives((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    refresh();
  }, [refresh]);

  // Estado del puente local (¿está corriendo en la PC del usuario?)
  useEffect(() => {
    let active = true;
    const check = () =>
      bridge
        .health()
        .then(() => active && setBridgeOk(true))
        .catch(() => active && setBridgeOk(false));
    check();
    const t = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  async function logout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/');
    router.refresh();
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function openEdit(live: Live) {
    setEditing(live);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function onSaved() {
    setFormOpen(false);
    setEditing(null);
    refresh();
  }

  const atLimit = (lives?.length ?? 0) >= MAX_LIVES;

  return (
    <main style={{ minHeight: '100dvh' }}>
      <header className="glass">
        <div className="container row between" style={{ height: 66 }}>
          <Wordmark sub="panel" />
          <div className="row" style={{ gap: 10 }}>
            <span className="badge" title={`Puente local · ${BRIDGE_URL}`}>
              <span
                className="dot"
                style={{ background: bridgeOk ? '#3d4a2a' : bridgeOk === false ? '#d97a3c' : '#b8ac93' }}
              />
              {bridgeOk === null ? 'Puente…' : bridgeOk ? 'Puente conectado' : 'Puente apagado'}
            </span>
            {email ? (
              <span className="mono" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                {email}
              </span>
            ) : null}
            <Link href="/" className="btn btn-quiet btn-sm">
              Ver sitio
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="container" style={{ padding: '40px 24px 80px' }}>
        {error ? (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 24 }}>
            <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
          </div>
        ) : null}

        {bridgeOk === false ? (
          <div className="card" style={{ borderColor: 'var(--amber)', marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>El puente no está corriendo</p>
            <p className="muted" style={{ fontSize: 14 }}>
              Puedes crear y editar transmisiones sin él. Para <strong>transmitir</strong> necesitas
              abrir el puente GOCAS en la PC que está en la red de la cámara: en la carpeta{' '}
              <span className="mono">bridge/</span> ejecuta <span className="mono">npm start</span>.
              En cuanto esté arriba, este aviso desaparece.
            </p>
          </div>
        ) : null}

        {/* Formulario */}
        {formOpen ? (
          <div style={{ marginBottom: 34 }}>
            <LiveForm
              initial={editing}
              watermarks={watermarks}
              onSaved={onSaved}
              onCancel={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            />
          </div>
        ) : null}

        {/* Marcas de agua */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ marginBottom: 18 }}>
            <p className="kicker" style={{ marginBottom: 8 }}>
              Tu identidad
            </p>
            <h2 className="h2">Marcas de agua</h2>
            <p className="lead" style={{ fontSize: 16, marginTop: 6 }}>
              Sube hasta 4 y elígelas al configurar cada transmisión.
            </p>
          </div>
          <WatermarkManager watermarks={watermarks} onChange={refresh} />
        </section>

        <hr className="divider" style={{ margin: '0 0 48px' }} />

        {/* Transmisiones */}
        <section>
          <div className="row between" style={{ marginBottom: 22, alignItems: 'flex-end' }}>
            <div>
              <p className="kicker" style={{ marginBottom: 8 }}>
                {lives?.length ?? 0}/{MAX_LIVES} activas
              </p>
              <h2 className="h2">Transmisiones</h2>
            </div>
            {!formOpen ? (
              <button
                className="btn btn-primary"
                onClick={openNew}
                disabled={atLimit}
                title={atLimit ? 'Máximo 2 transmisiones por cuenta' : undefined}
              >
                Nueva transmisión
              </button>
            ) : null}
          </div>

          {!lives ? (
            <p className="muted">Cargando…</p>
          ) : lives.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '46px 24px' }}>
              <p style={{ fontSize: 17, marginBottom: 16 }}>
                Aún no tienes transmisiones. Crea la primera para empezar.
              </p>
              {!formOpen ? (
                <button className="btn btn-primary" onClick={openNew}>
                  Nueva transmisión
                </button>
              ) : null}
            </div>
          ) : (
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}
            >
              {lives.map((l) => (
                <LiveCard
                  key={l.id}
                  live={l}
                  watermarks={watermarks}
                  onEdit={openEdit}
                  onDeleted={refresh}
                />
              ))}
            </div>
          )}
          {atLimit ? (
            <p className="hint" style={{ marginTop: 14 }}>
              Alcanzaste el máximo de {MAX_LIVES} transmisiones. Elimina una para crear otra.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
