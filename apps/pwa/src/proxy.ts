import { createCookieSupabase, isSupabaseConfigured } from '@kayamo/db';
import { type NextRequest, NextResponse } from 'next/server';

/** Capacitor 7 androidScheme is https — the WebView origin, not a remote URL. */
const CAPACITOR_WEBVIEW_ORIGIN = 'https://localhost';

function withCapacitorCors(response: NextResponse, origin: string | null): NextResponse {
  if (origin === CAPACITOR_WEBVIEW_ORIGIN) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get('origin');
  const isApp = pathname === '/app' || pathname.startsWith('/app/');
  const isLogin = pathname === '/login';
  const isApi = pathname.startsWith('/api/');

  if (isApi && request.method === 'OPTIONS') {
    return withCapacitorCors(new NextResponse(null, { status: 204 }), origin);
  }

  if (!isSupabaseConfigured()) {
    if (isApp) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('setup', '1');
      return NextResponse.redirect(url);
    }
    return withCapacitorCors(NextResponse.next(), origin);
  }

  let response = NextResponse.next({ request });
  const supabase = createCookieSupabase({
    getAll: () => request.cookies.getAll(),
    setAll: (toSet) => {
      for (const { name, value } of toSet) {
        request.cookies.set(name, value);
      }
      response = NextResponse.next({ request });
      for (const { name, value, options } of toSet) {
        response.cookies.set(name, value, options);
      }
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isApp && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return isApi ? withCapacitorCors(response, origin) : response;
}

export const config = {
  matcher: ['/app/:path*', '/login', '/api/:path*'],
};
