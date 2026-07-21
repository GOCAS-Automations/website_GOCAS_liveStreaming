import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANTE: getUser() refresca el token si hace falta.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rutas protegidas: /panel requiere sesión.
  if (!user && request.nextUrl.pathname.startsWith('/panel')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Si ya hay sesión y va a /login, mándalo al panel.
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/panel';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
