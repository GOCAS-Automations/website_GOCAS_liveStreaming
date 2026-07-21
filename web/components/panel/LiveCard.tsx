'use client';

import { useState } from 'react';
import { deleteLive, type Live, type Watermark } from '@/lib/data';

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
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const wm = watermarks.find((w) => w.id === live.watermark_id) || null;
  const hasVideo = !!live.youtube_video_id;

  async function remove() {
    setBusy(true);
    try {
      await deleteLive(live.id);
      onDeleted();
    } catch {
      setBusy(false);
    }
  }

  function copyLink() {
    const url = `${window.location.origin}/live/${live.slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <div className="card">
      <div className="row between" style={{ gap: 14, marginBottom: 16 }}>
        <div className="row" style={{ gap: 13 }}>
          <div
            className="stage"
            style={{ width: 58, height: 58, aspectRatio: 'auto', borderRadius: 12, flex: 'none' }}
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
            <a
              href={`/live/${live.slug}`}
              target="_blank"
              rel="noreferrer"
              className="mono"
              style={{ fontSize: 12.5, color: 'var(--muted)' }}
            >
              /live/{live.slug} ↗
            </a>
          </div>
        </div>
        <span className={`badge ${hasVideo ? 'badge-ready' : ''}`}>
          {hasVideo ? (
            <>
              <span className="dot" /> Listo
            </>
          ) : (
            'Sin video'
          )}
        </span>
      </div>

      {live.description ? (
        <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
          {live.description}
        </p>
      ) : null}

      <div className="row">
        <a href={`/live/${live.slug}`} target="_blank" rel="noreferrer" className="btn btn-olive btn-sm">
          Ver página
        </a>
        <button className="btn btn-ghost btn-sm" onClick={copyLink}>
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
        <button className="btn btn-quiet btn-sm" onClick={() => onEdit(live)}>
          Editar
        </button>
        {confirmDel ? (
          <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            <button className="btn btn-danger btn-sm" onClick={remove} disabled={busy}>
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
            style={{ marginLeft: 'auto', color: 'var(--danger)' }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
