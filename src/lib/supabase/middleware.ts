import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/auth/jwt';
import { isDemoModeAllowed } from '@/lib/authConfig';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/register');
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/groups') ||
    request.nextUrl.pathname.startsWith('/profile');

  // 1. Check native session token from cookie
  const accessToken = request.cookies.get('sb-access-token')?.value;
  let activeUser: { id: string; email: string } | null = null;

  if (accessToken) {
    const nativePayload = await verifyJwt(accessToken);
    if (nativePayload) {
      activeUser = {
        id: nativePayload.sub,
        email: nativePayload.email,
      };
    }
  }

  // 2. Check demo user cookie if demo mode is permitted
  if (!activeUser && isDemoModeAllowed()) {
    const demoCookie = request.cookies.get('pachas_demo_user')?.value;
    if (demoCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(demoCookie));
        if (parsed?.id && parsed?.email) {
          activeUser = { id: parsed.id, email: parsed.email };
        }
      } catch {}
    }
  }

  // 3. Fallback to Supabase SSR client check if native token not verified
  if (!activeUser) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder')) {
      const isHttps =
        request.headers.get('x-forwarded-proto') === 'https' ||
        request.url.startsWith('https://');

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, {
                ...options,
                sameSite: options?.sameSite || 'lax',
                secure: isHttps,
                path: '/',
              })
            );
          },
        },
      });

      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          activeUser = {
            id: data.user.id,
            email: data.user.email || '',
          };
        }
      } catch {}
    }
  }

  if (!activeUser && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (activeUser && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
