'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteLive, type Live, type Watermark } from '@/lib/data';
import { bridge, hlsUrl, type BridgeStatus } from '@/lib/bridge';
import { useToast } from '@/lib/toast';
import HlsPreview from '@/components/HlsPreview';

const BADGE: Record<string, { cls: string; label: string; pulse?: boolean }> = {
  idle: { cls: 'badge', label: 'Detenido' },
  starting: { cls: 'badge', label: 'Iniciando' },
  preview: { cls: 'badge badge-ready', label: 'Preview', pulse: true },
  live: { cls: 'badge badge-live', label: 'En vivo', pulse: true },
  restarting: { cls: 'badge badge-ready', label: 'Reconectando', pulse: true },
  error: { cls: 'badge', label: 'Error' },
};

export default function LiveCard({
  live,
  watermarks,
  onEdit,
  onDeleted,
}: {
  live: Live;
  watermarks: Watermark[];
  onEdit: (live: Live) => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const wm = watermarks.find((w) => w.id === live.watermark_id) || null;

  const [rtsp, setRtsp] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [audio, setAudio] = useState<'camera' | 'silent'>('camera');
  const [status, setStatus] = useState<BridgeStatus>({ status: 'idle', mode: null });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const lastErrRef = useRef<string | null>(null);

  const active = status.status !== 'idle' && status.status !== 'error';

  const poll = useCallback(async () => {
    try {
      const { status: s } = await bridge.status(live.id);
      setStatus(s);
      if (s.status === 'error' && s.lastError && lastErrRef.current !== s.lastError) {
        lastErrRef.current = s.lastError;
        toast.error(s.lastError);
      }
      if (s.status !== 'error') lastErrRef.current = null;
    } catch {
      /* puente apagado: no spamear */
    }
  }, [live.id, toast]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]);

  function buildBody(mode: 'preview' | 'youtube') {
    return {
      mode,
      rtspUrl: rtsp.trim(),
      streamKey: streamKey.trim(),
      watermarkUrl: wm?.url ?? null,
      position: live.wm_position,
      opacity: live.wm_opacity,
      scale: live.wm_scale,
      margin: live.wm_margin,
      audio,
      videoBitrate: '4500k',
    };
  }

  async function start(mode: 'preview' | 'youtube') {
    if (!rtsp.trim()) {
      toast.warning('Pega la URL RTSP de tu cámara.');
      return;
    }
    if (mode === 'youtube' && !streamKey.trim()) {
      toast.warning('Pega la clave de retransmisión de YouTube.');
      return;
    }
    setBusy(true);
    try {
      const { status: s } = await bridge.start(live.id, buildBody(mode));
      setStatus(s);
      lastErrRef.current = null;
      toast.success(
        mode === 'youtube'
          ? `Transmitiendo "${live.title}" a YouTube.`
          : `Preview local de "${live.title}" iniciado.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo iniciar.';
      toast.error(
        /fetch|Failed|NetworkError|Load failed/i.test(msg)
          ? 'No hay conexión con el puente. ¿Lo tienes corriendo en tu PC?'
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      const { status: s } = await bridge.stop(live.id);
      setStatus(s);
      toast.info(`"${live.title}" detenido.`);
    } catch {
      toast.error('No se pudo detener (¿puente apagado?).');
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

  const badge = BADGE[status.status] || BADGE.idle;

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

      {/* Preview HLS cuando corre preview local */}
      {status.status === 'preview' ? (
        <div style={{ marginBottom: 14 }}>
          <div className="stage">
            <HlsPreview src={hlsUrl(live.id)} />
          </div>
          <p className="hint" style={{ marginTop: 6 }}>
            Preview local con la marca incrustada. Puede tardar unos segundos en aparecer.
          </p>
        </div>
      ) : null}

      {/* Credenciales (solo cuando está detenido) */}
      {!active ? (
        <div style={{ marginBottom: 12 }}>
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
          <div className="row" style={{ gap: 10, alignItems: 'flex-end' }}>
            <label className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <span>Clave de retransmisión de YouTube</span>
              <input
                className="input mono"
                type="password"
                value={streamKey}
                onChange={(e) => setStreamKey(e.target.value)}
                placeholder="xxxx-xxxx-xxxx-xxxx"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="field" style={{ marginBottom: 0, width: 140 }}>
              <span>Audio</span>
              <select
                className="select"
                value={audio}
                onChange={(e) => setAudio(e.target.value as 'camera' | 'silent')}
              >
                <option value="camera">De la cámara</option>
                <option value="silent">Silencio</option>
              </select>
            </label>
          </div>
          <p className="hint">No se guardan: viven en memoria mientras transmites.</p>
        </div>
      ) : null}

      {/* Controles */}
      <div className="row">
        {!active ? (
          <>
            <button className="btn btn-olive btn-sm" onClick={() => start('preview')} disabled={busy}>
              Preview local
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => start('youtube')} disabled={busy}>
              Transmitir a YouTube
            </button>
          </>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={stop} disabled={busy}>
            Detener
          </button>
        )}
        <button className="btn btn-quiet btn-sm" onClick={() => onEdit(live)} disabled={active}>
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
            disabled={active}
            style={{ marginLeft: 'auto', color: 'var(--danger)' }}
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Logs */}
      {active && status.logTail && status.logTail.length > 0 ? (
        <details style={{ marginTop: 12 }}>
          <summary
            className="mono"
            style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}
          >
            Registro de FFmpeg
          </summary>
          <div className="log" style={{ marginTop: 8 }}>
            {status.logTail.join('\n')}
          </div>
        </details>
      ) : null}
    </div>
  );
}
