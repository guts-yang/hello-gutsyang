import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from './i18n';

const intlMiddleware = createMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'always',
});

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') return NextResponse.next();
    return await guardAdmin(req);
  }

  return intlMiddleware(req);
}

function adminSessionCookieName() {
  return process.env.ADMIN_SESSION_COOKIE || 'hello_gutsyang_admin_session';
}

async function guardAdmin(req: NextRequest) {
  // Fast path: presence of the session cookie only. The dashboard layout performs
  // the authoritative Go API session check once per navigation.
  const sessionCookie = adminSessionCookieName();
  if (!req.cookies.get(sessionCookie)?.value) {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const redirectUrl = new URL('/admin/login', req.url);
  if (req.nextUrl.pathname !== '/admin/login') {
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
  }
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
