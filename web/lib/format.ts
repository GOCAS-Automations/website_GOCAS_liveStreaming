export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export function slugify(value: string): string {
  const stripped = String(value || '')
    .normalize('NFD')
    .split('')
    .filter((ch) => {
      const c = ch.codePointAt(0)!;
      return c < 0x300 || c > 0x36f;
    })
    .join('');
  return (
    stripped
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'live'
  );
}

// Acepta URL completa (watch?v=, youtu.be/, /live/, embed/) o el ID de 11 chars.
export function extractYouTubeId(input: string): string {
  const s = String(input || '').trim();
  if (!s) return '';
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = p.exec(s);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return s;
}
