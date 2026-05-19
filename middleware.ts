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

async function guardAdmin(req: NextRequest) {
  const backendUrl = (process.env.GO_API_INTERNAL_URL || process.env.GO_API_URL || '').replace(/\/$/, '');
  if (!backendUrl) {
    return redirectToLogin(req);
  }

  const cookieHeader = req.cookies
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join('; ');

  // Hard cap session lookup so a hung backend cannot stall every admin
  // request indefinitely. On timeout we treat the request as unauthenticated
  // and redirect to the login page rather than rendering a broken admin shell.
  let response: Response;
  try {
    response = await fetch(`${backendUrl}/v1/admin/session`, {
      headers: {
        cookie: cookieHeader,
        accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return redirectToLogin(req);
  }

  if (!response.ok) {
    return redirectToLogin(req);
  }

  const session = (await response.json().catch(() => null)) as { authenticated?: boolean } | null;
  if (!session?.authenticated) {
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
