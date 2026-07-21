import { createClient } from '@/lib/supabase/client';
import type { WatermarkPosition } from '@/lib/format';

const BUCKET = 'watermarks';
export const MAX_LIVES = 2;
export const MAX_WATERMARKS = 4;

export interface Watermark {
  id: string;
  name: string;
  storage_path: string;
  url: string;
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

export function watermarkPublicUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

// ---------- Watermarks ----------
export async function listWatermarks(): Promise<Watermark[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from('watermarks')
    .select('*')
    .order('created_at', { ascending: true });
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
    await sb.storage.from(BUCKET).remove([path]); // rollback
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

// ---------- Lives ----------
export async function listLives(): Promise<Live[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from('lives')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Live[];
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
    const { data, error } = await sb
      .from('lives')
      .update(row)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw error;
    return data as Live;
  }
  const { data, error } = await sb.from('lives').insert(row).select('*').single();
  if (error) throw error;
  return data as Live;
}

export async function deleteLive(id: string): Promise<void> {
  const sb = createClient();
  const { error } = await sb.from('lives').delete().eq('id', id);
  if (error) throw error;
}
