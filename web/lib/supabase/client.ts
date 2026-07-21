import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

// Cliente para el navegador. Usa la clave publishable (pública por diseño).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
