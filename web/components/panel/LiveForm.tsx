'use client';

import { useMemo, useState } from 'react';
import { saveLive, type Live, type Watermark } from '@/lib/data';
import { slugify, type WatermarkPosition } from '@/lib/format';
import { POSITIONS } from '@/lib/tokens';
import { WatermarkFrame } from '@/components/ui';
import { useToast } from '@/lib/toast';

interface Props {
  initial: Live | null;
  watermarks: Watermark[];
  onSaved: () => void;
  onCancel: () => void;
}

export default function LiveForm({ initial, watermarks, onSaved, onCancel }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [watermarkId, setWatermarkId] = useState<string | null>(initial?.watermark_id ?? null);
  const [position, setPosition] = useState<WatermarkPosition>(
    (initial?.wm_position as WatermarkPosition) || 'bottom-right',
  );
  const [opacity, setOpacity] = useState(initial?.wm_opacity ?? 0.85);
  const [scale, setScale] = useState(initial?.wm_scale ?? 0.15);
  const [margin, setMargin] = useState(initial?.wm_margin ?? 24);
  const [saving, setSaving] = useState(false);

  const selectedWm = useMemo(
    () => watermarks.find((w) => w.id === watermarkId) || null,
    [watermarks, watermarkId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning('El título es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      await saveLive({
        id: initial?.id,
        title: title.trim().slice(0, 120),
        slug: slugify(title),
        description: description.trim().slice(0, 400),
        youtube_video_id: '',
        watermark_id: watermarkId,
        wm_position: position,
        wm_opacity: opacity,
        wm_scale: scale,
        wm_margin: margin,
      });
      toast.success(initial ? 'Transmisión actualizada.' : 'Transmisión creada.');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  const marginDisabled = position === 'center';

  return (
    <form className="card" onSubmit={submit} style={{ borderColor: 'var(--amber)' }}>
      <div className="row between" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 20 }}>{initial ? 'Editar transmisión' : 'Nueva transmisión'}</h3>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel}>
          Cerrar
        </button>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,360px)', gap: 26, alignItems: 'start' }}
      >
        {/* Datos */}
        <div>
          <label className="field">
            <span>Título</span>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Cámara Principal"
              maxLength={120}
            />
          </label>

          <label className="field" style={{ marginBottom: 0 }}>
            <span>Descripción — opcional</span>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para identificar esta transmisión (cámara, ubicación…)."
              maxLength={400}
            />
          </label>
        </div>

        {/* Marca de agua */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--olive)', marginBottom: 10 }}>
            Marca de agua sobre el video
          </p>
          <WatermarkFrame
            url={selectedWm?.url ?? null}
            position={position}
            opacity={opacity}
            scale={scale}
            margin={margin}
          />

          <label className="field" style={{ marginTop: 16 }}>
            <span>Marca</span>
            <select
              className="select"
              value={watermarkId ?? ''}
              onChange={(e) => setWatermarkId(e.target.value || null)}
            >
              <option value="">Sin marca de agua</option>
              {watermarks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {watermarks.length === 0 ? (
              <span className="hint">Sube una marca arriba para poder elegirla aquí.</span>
            ) : null}
          </label>

          <label className="field">
            <span>Posición</span>
            <select
              className="select"
              value={position}
              onChange={(e) => setPosition(e.target.value as WatermarkPosition)}
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Tamaño — {Math.round(scale * 100)}% del ancho</span>
            <input
              type="range"
              min={5}
              max={100}
              value={Math.round(scale * 100)}
              onChange={(e) => setScale(Number(e.target.value) / 100)}
            />
            <span className="hint">Súbelo hasta 100% para cubrir todo el ancho del video.</span>
          </label>

          <label className="field">
            <span>Opacidad — {Math.round(opacity * 100)}%</span>
            <input
              type="range"
              min={20}
              max={100}
              step={5}
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            />
          </label>

          <label className="field" style={{ marginBottom: 0, opacity: marginDisabled ? 0.5 : 1 }}>
            <span>Margen — {margin}px</span>
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={margin}
              onChange={(e) => setMargin(Number(e.target.value))}
              disabled={marginDisabled}
            />
            <span className="hint">
              {marginDisabled
                ? 'El margen no aplica cuando la posición es Centro.'
                : 'Separación desde el borde (solo en las esquinas).'}
            </span>
          </label>
        </div>
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear transmisión'}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
