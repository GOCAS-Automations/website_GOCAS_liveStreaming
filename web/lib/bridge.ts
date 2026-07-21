// Cliente del "puente" local (Node+FFmpeg) que corre en la PC del usuario, en la
// misma red de la cámara RTSP. El navegador habla con él en http://localhost:4000.
// (localhost está exento de bloqueo por contenido mixto; el puente responde CORS + PNA.)
export const BRIDGE_URL =
  process.env.NEXT_PUBLIC_BRIDGE_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export interface BridgeStatus {
  status: 'idle' | 'starting' | 'preview' | 'live' | 'restarting' | 'error';
  mode: 'preview' | 'youtube' | null;
  startedAt?: string;
  restarts?: number;
  lastError?: string | null;
  logTail?: string[];
}

export interface StartBody {
  mode: 'preview' | 'youtube';
  rtspUrl: string;
  streamKey?: string;
  watermarkUrl?: string | null;
  position: string;
  opacity: number;
  scale: number;
  margin: number;
  audio?: 'camera' | 'silent';
  videoBitrate?: string;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BRIDGE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data as T;
}

export const bridge = {
  health: () => req<{ ok: boolean; ffmpeg: string; version: string }>('/health'),
  start: (id: string, body: StartBody) =>
    req<{ status: BridgeStatus }>(`/api/streams/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  stop: (id: string) =>
    req<{ status: BridgeStatus }>(`/api/streams/${id}/stop`, { method: 'POST' }),
  status: (id: string) => req<{ status: BridgeStatus }>(`/api/streams/${id}/status`),
};

export function hlsUrl(id: string) {
  return `${BRIDGE_URL}/hls/${id}/index.m3u8`;
}
