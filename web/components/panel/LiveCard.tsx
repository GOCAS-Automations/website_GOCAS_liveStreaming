'use client';

import { useState } from 'react';
import {
  deleteLive,
  goLive,
  stopLive,
  agentOnline,
  type Live,
  type Watermark,
  type Agent,
} from '@/lib/data';
import { useToast } from '@/lib/toast';

const STATE_BADGE: Record<string, { cls: string; label: string; pulse?: boolean }> = {
  idle: { cls: 'badge', label: 'Detenido' },
  starting: { cls: 'badge badge-ready', label: 'Iniciando', pulse: true },
  live: { cls: 'badge badge-live', label: 'En vivo', pulse: true },
  restarting: { cls: 'badge badge-ready', label: 'Reconectando', pulse: true },
  error: { cls: 'badge', label: 'Error' },
};

export default function LiveCard({
  live,
  watermarks,
  agents,
  onEdit,
  onDeleted,
}: {
  live: Live;
  watermarks: Watermark[];
  agents: Agent[];
  onEdit: (live: Live) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const wm = watermarks.find((w) => w.id === live.watermark_id) || null;
  const isLive = live.desired_state === 'live';

  const [rtsp, setRtsp] = useState('');
  const [youtubeKey, setYoutubeKey] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // Estado a mostrar: si desired=idle -> Detenido; si live -> lo que reporta el agente.
  const badge = isLive
    ? STATE_BADGE[live.current_state] || STATE_BADGE.starting
    : STATE_BADGE.idle;

  async function transmit() {
    if (!agentId) {
      toast.warning('Elige un dispositivo (agente).');
      return;
    }
    if (!rtsp.trim()) {
      toast.warning('Pega la URL RTSP de tu cámara.');
      return;
    }
    if (!youtubeKey.trim()) {
      toast.warning('Pega la clave de retransmisión de YouTube.');
      return;
    }
    if (/:\/\//.test(youtubeKey) || /^rtsp/i.test(youtubeKey.trim())) {
      toast.error(
        'Eso parece una URL, no la clave de YouTube. La clave es un código corto (ej. abcd-1234-…) que copias en YouTube Studio → Transmitir en vivo → "Clave de retransmisión".',
      );
      return;
    }
    if (!/^rtsps?:\/\//i.test(rtsp.trim())) {
      toast.error('La URL de la cámara debe empezar con rtsp:// (o rtsps://).');
      return;
    }
    setBusy(true);
    try {
      await goLive(live.id, { agentId, rtspUrl: rtsp.trim(), youtubeKey: youtubeKey.trim() });
      setRtsp('');
      setYoutubeKey('');
      toast.success(`Orden enviada. El agente iniciará "${live.title}".`);
      onDeleted(); // refresca la lista
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar.');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await stopLive(live.id);
      toast.info(`Deteniendo "${live.title}".`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo detener.');
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    setBusy(true);
    try {
      await deleteLive(live.id);
      toast.success(`"${live.title}" eliminado.`);
      onDeleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar.');
      setBusy(false);
    }
  }

  const noAgents = agents.length === 0;

  return (
    <div className="card">
      <div className="row between" style={{ gap: 14, marginBottom: 16 }}>
        <div className="row" style={{ gap: 13 }}>
          <div
            className="stage"
            style={{ width: 56, height: 56, aspectRatio: 'auto', borderRadius: 12, flex: 'none' }}
          >
            {wm ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={wm.url}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  margin: 'auto',
                  maxWidth: '70%',
                  maxHeight: '70%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <span
                className="mono"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  color: '#8a8a76',
                }}
              >
                sin marca
              </span>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 18 }}>{live.title}</h3>
            {live.description ? (
              <p className="muted" style={{ fontSize: 13 }}>
                {live.description}
              </p>
            ) : null}
          </div>
        </div>
        <span className={badge.cls}>
          <span className={`dot${badge.pulse ? ' dot-pulse' : ''}`} />
          {badge.label}
        </span>
      </div>

      {/* Error reportado por el agente */}
      {isLive && live.current_state === 'error' && live.status_error ? (
        <p style={{ color: 'var(--danger)', fontSize: 13.5, marginBottom: 12 }}>{live.status_error}</p>
      ) : null}

      {/* Formulario de transmisión (cuando está detenido) */}
      {!isLive ? (
        <div style={{ marginBottom: 12 }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
            <label className="field" style={{ marginBottom: 10, flex: 1, minWidth: 200 }}>
              <span>Dispositivo (agente)</span>
              <select
                className="select"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                disabled={noAgents}
              >
                {noAgents ? <option value="">Vincula un dispositivo arriba</option> : null}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {agentOnline(a) ? '· en línea' : '· desconectado'}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field" style={{ marginBottom: 10 }}>
            <span>URL RTSP de la cámara</span>
            <input
              className="input mono"
              value={rtsp}
              onChange={(e) => setRtsp(e.target.value)}
              placeholder="rtsp://usuario:clave@192.168.1.10:554/stream1"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="field" style={{ marginBottom: 6 }}>
            <span>Clave de retransmisión de YouTube</span>
            <input
              className="input mono"
              type="password"
              value={youtubeKey}
              onChange={(e) => setYoutubeKey(e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hint">
              NO es una URL: es el código corto de YouTube Studio → Transmitir en vivo → “Clave de
              retransmisión”.
            </span>
          </label>
          <p className="hint">
            Se guardan mientras transmites y se borran al detener. El agente en tu red debe estar en
            línea.
          </p>
        </div>
      ) : null}

      {/* Controles */}
      <div className="row">
        {!isLive ? (
          <button className="btn btn-primary btn-sm" onClick={transmit} disabled={busy || noAgents}>
            Transmitir a YouTube
          </button>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={stop} disabled={busy}>
            Detener
          </button>
        )}
        <button className="btn btn-quiet btn-sm" onClick={() => onEdit(live)} disabled={isLive}>
          Editar
        </button>
        {confirmDel ? (
          <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-danger btn-sm" onClick={del} disabled={busy}>
              Eliminar
            </button>
            <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDel(false)}>
              No
            </button>
          </div>
        ) : (
          <button
            className="btn btn-quiet btn-sm"
            onClick={() => setConfirmDel(true)}
            disabled={isLive}
            style={{ marginLeft: 'auto', color: 'var(--danger)' }}
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Log del agente */}
      {isLive && live.log_tail ? (
        <details style={{ marginTop: 12 }}>
          <summary className="mono" style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>
            Registro del agente
          </summary>
          <div className="log" style={{ marginTop: 8 }}>
            {live.log_tail}
          </div>
        </details>
      ) : null}
    </div>
  );
}
