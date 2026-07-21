'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const sb = createClient();
    try {
      if (mode === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/panel');
        router.refresh();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push('/panel');
          router.refresh();
        } else {
          setInfo('Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.');
          setMode('signin');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <Wordmark />
        </div>

        <div className="card">
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>
            {mode === 'signin' ? 'Inicia sesión' : 'Crea tu cuenta'}
          </h1>
          <p className="muted" style={{ fontSize: 14.5, marginBottom: 22 }}>
            {mode === 'signin'
              ? 'Entra para gestionar tus transmisiones.'
              : 'Empieza a transmitir con tu marca en minutos.'}
          </p>

          <form onSubmit={submit}>
            <label className="field">
              <span>Correo</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                required
                autoComplete="email"
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              />
            </label>

            {error ? (
              <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
            ) : null}
            {info ? (
              <p style={{ color: 'var(--olive)', fontSize: 14, marginBottom: 12 }}>{info}</p>
            ) : null}

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Un momento…' : mode === 'signin' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 14.5 }}>
          {mode === 'signin' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            className="mono"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setInfo(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--amber)',
              cursor: 'pointer',
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            {mode === 'signin' ? 'Créala' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </main>
  );
}
