import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { WatermarkPosition } from '@/lib/format';

export function Wordmark({ sub = 'live' }: { sub?: string | null }) {
  return (
    <Link href="/" className="wordmark" aria-label="GOCAS Live — inicio">
      <span>
        <span className="bracket">[</span> GOCAS <span className="bracket">]</span>
      </span>
      {sub ? <span className="sub">{sub}</span> : null}
    </Link>
  );
}

export function wmOverlayStyle(
  position: WatermarkPosition,
  scale: number,
  opacity: number,
  margin: number,
): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 2,
    width: `${Math.round(scale * 100)}%`,
    height: 'auto',
    opacity,
  };
  const m = `${margin}px`;
  switch (position) {
    case 'top-left':
      return { ...base, top: m, left: m };
    case 'top-right':
      return { ...base, top: m, right: m };
    case 'bottom-left':
      return { ...base, bottom: m, left: m };
    case 'center':
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'bottom-right':
    default:
      return { ...base, bottom: m, right: m };
  }
}

export function WatermarkFrame({
  url,
  position,
  opacity,
  scale,
  margin,
  maxWidth,
}: {
  url: string | null;
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  margin: number;
  maxWidth?: number;
}) {
  return (
    <div className="stage" style={{ maxWidth }}>
      <div className="stage-empty">
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.16em', opacity: 0.7 }}>
          TU VIDEO EN VIVO
        </span>
      </div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="marca de agua" style={wmOverlayStyle(position, scale, opacity, margin)} />
      ) : null}
    </div>
  );
}
