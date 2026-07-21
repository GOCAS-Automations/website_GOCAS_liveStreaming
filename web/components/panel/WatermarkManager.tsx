'use client';

import { useRef, useState } from 'react';
import {
  MAX_WATERMARKS,
  uploadWatermark,
  renameWatermark,
  deleteWatermark,
  type Watermark,
} from '@/lib/data';

export default function WatermarkManager({
  watermarks,
  onChange,
}: {
  watermarks: Watermark[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const atLimit = watermarks.length >= MAX_WATERMARKS;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!/^image\//.test(file.type)) {
      setError('Debe ser una imagen (idealmente PNG con transparencia).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen supera los 3 MB.');
      return;
    }
    setBusy(true);
    try {
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'marca';
      await uploadWatermark(file, name);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveRename(id: string) {
    if (!editName.trim()) return;
    setBusy(true);
    try {
      await renameWatermark(id, editName);
      setEditing(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo renombrar.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(wm: Watermark) {
    setBusy(true);
    try {
      await deleteWatermark(wm);
      setConfirmDel(null);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error ? (
        <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</p>
      ) : null}

      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))' }}
      >
        {watermarks.map((wm) => (
          <div key={wm.id} className="card-flat" style={{ padding: 14 }}>
            <div
              className="stage"
              style={{ aspectRatio: '16 / 10', borderRadius: 12, marginBottom: 12 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={wm.url}
                alt={wm.name}
                style={{
                  position: 'absolute',
                  inset: 0,
                  margin: 'auto',
                  maxWidth: '72%',
                  maxHeight: '72%',
                  objectFit: 'contain',
                  width: 'auto',
                  height: 'auto',
                }}
              />
            </div>

            {editing === wm.id ? (
              <div className="row" style={{ gap: 6 }}>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ padding: '7px 10px', fontSize: 13 }}
                  autoFocus
                  maxLength={40}
                />
                <button className="btn btn-primary btn-sm" onClick={() => saveRename(wm.id)} disabled={busy}>
                  OK
                </button>
              </div>
            ) : (
              <>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 8,
                  }}
                  title={wm.name}
                >
                  {wm.name}
                </p>
                {confirmDel === wm.id ? (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(wm)} disabled={busy}>
                      Eliminar
                    </button>
                    <button className="btn btn-quiet btn-sm" onClick={() => setConfirmDel(null)}>
                      No
                    </button>
                  </div>
                ) : (
                  <div className="row" style={{ gap: 6 }}>
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => {
                        setEditing(wm.id);
                        setEditName(wm.name);
                      }}
                    >
                      Renombrar
                    </button>
                    <button
                      className="btn btn-quiet btn-sm"
                      onClick={() => setConfirmDel(wm.id)}
                      style={{ color: 'var(--danger)' }}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {/* Tile de subida */}
        {!atLimit ? (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="card-flat"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 168,
              border: '1.5px dashed var(--line)',
              background: 'var(--surface-2)',
              cursor: busy ? 'wait' : 'pointer',
              color: 'var(--olive)',
            }}
          >
            <span style={{ fontSize: 30, lineHeight: 1, color: 'var(--amber)' }}>+</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {busy ? 'Subiendo…' : 'Subir marca'}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
              PNG · máx 3 MB
            </span>
          </button>
        ) : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        onChange={onFile}
        style={{ display: 'none' }}
      />

      <p className="hint" style={{ marginTop: 12 }}>
        {watermarks.length}/{MAX_WATERMARKS} marcas. Súbelas con fondo transparente (PNG) para que
        se vean bien sobre el video.
      </p>
    </div>
  );
}
