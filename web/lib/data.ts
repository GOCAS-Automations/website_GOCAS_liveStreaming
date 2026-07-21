import { createClient } from '@/lib/supabase/client';
import type { WatermarkPosition } from '@/lib/format';

const BUCKET = 'watermarks';
export const MAX_LIVES = 2;
export const MAX_WATERMARKS = 4;
export const MAX_AGENTS = 3;

export interface Watermark {
  id: string;
  name: string;
  storage_path: string;
  url: string;
  created_at: string;
}

export interface Agent {
  id: string;
  name: string;
  last_seen_at: string | null;
  created_at: string;
}

export interface Live {
  id: string;
  slug: string;
  title: string;
  description: string;
  youtube_video_id: string;
  watermark_id: string | null;
  wm_position: WatermarkPosition;
  wm_opacity: number;
  wm_scale: number;
  wm_margin: number;
  agent_id: string | null;
  desired_state: 'idle' | 'live';
  current_state: string;
  status_error: string | null;
  status_updated_at: string | null;
  log_tail: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveInput {
  id?: string;
  slug: string;
  title: string;
  description: string;
  youtube_video_id: string;
  watermark_id: string | null;
  wm_position: WatermarkPosition;
  wm_opacity: number;
  wm_scale: number;
  wm_margin: number;
}

// Un agente cuenta como "en línea" si reportó en los últimos ~20s.
export function agentOnline(a: Agent): boolean {
  if (!a.last_seen_at) return false;
  return Date.now() - new Date(a.last_seen_at).getTime() < 20000;
}

export function watermarkPublicUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

// ---------- Watermarks ----------
export async function listWatermarks(): Promise<Watermark[]> {
  const sb = createClient();
  const { data, error } = await sb.from('watermarks').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((w) => ({ ...w, url: watermarkPublicUrl(w.storage_path) }));
}

export async function uploadWatermark(file: File, name: string): Promise<Watermark> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('No autenticado.');
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await sb
    .from('watermarks')
    .insert({ user_id: user.id, name: name.trim() || file.name, storage_path: path })
    .select('*')
    .single();
  if (error) {
    await sb.storage.from(BUCKET).remove([path]);
    throw error;
  }
  return { ...data, url: watermarkPublicUrl(data.storage_path) };
}

export async function renameWatermark(id: string, name: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from('watermarks').update({ name: name.trim() }).eq('id', id);
  if (error) throw error;
}

export async function deleteWatermark(wm: { id: string; storage_path: string }): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from('watermarks').delete().eq('id', wm.id);
  if (error) throw error;
  await sb.storage.from(BUCKET).remove([wm.storage_path]);
}

// ---------- Agentes ----------
function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export async function listAgents(): Promise<Agent[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from('agents')
    .select('id,name,last_seen_at,created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Agent[];
}

export async function createAgent(name: string): Promise<{ agent: Agent; token: string }> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('No autenticado.');
  const token = randomToken();
  const token_hash = await sha256hex(token);
  const { data, error } = await sb
    .from('agents')
    .insert({ user_id: user.id, name: name.trim() || 'Mi PC', token_hash })
    .select('id,name,last_seen_at,created_at')
    .single();
  if (error) throw error;
  return { agent: data as Agent, token };
}

export async function deleteAgent(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from('agents').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Lives ----------
const LIVE_COLS =
  'id,slug,title,description,youtube_video_id,watermark_id,wm_position,wm_opacity,wm_scale,wm_margin,agent_id,desired_state,current_state,status_error,status_updated_at,log_tail,created_at,updated_at';

export async function listLives(): Promise<Live[]> {
  const sb = createClient();
  const { data, error } = await sb.from('lives').select(LIVE_COLS).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Live[];
}

export async function saveLive(input: LiveInput): Promise<Live> {
  const sb = createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('No autenticado.');
  const row = {
    user_id: user.id,
    slug: input.slug,
    title: input.title,
    description: input.description,
    youtube_video_id: input.youtube_video_id,
    watermark_id: input.watermark_id,
    wm_position: input.wm_position,
    wm_opacity: input.wm_opacity,
    wm_scale: input.wm_scale,
    wm_margin: input.wm_margin,
  };
  if (input.id) {
    const { data, error } = await sb.from('lives').update(row).eq('id', input.id).select(LIVE_COLS).single();
    if (error) throw error;
    return data as unknown as Live;
  }
  const { data, error } = await sb.from('lives').insert(row).select(LIVE_COLS).single();
  if (error) throw error;
  return data as unknown as Live;
}

export async function deleteLive(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from('lives').delete().eq('id', id);
  if (error) throw error;
}

// Transmitir: guarda secretos + agente y marca desired_state='live'. El agente lo recoge.
export async function goLive(
  liveId: string,
  opts: { agentId: string; rtspUrl: string; youtubeKey: string },
): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from('lives')
    .update({
      agent_id: opts.agentId,
      rtsp_url: opts.rtspUrl,
      youtube_key: opts.youtubeKey,
      desired_state: 'live',
    })
    .eq('id', liveId);
  if (error) throw error;
}

// Detener: borra los secretos y marca desired_state='idle'.
export async function stopLive(liveId: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb
    .from('lives')
    .update({ desired_state: 'idle', rtsp_url: null, youtube_key: null })
    .eq('id', liveId);
  if (error) throw error;
}
