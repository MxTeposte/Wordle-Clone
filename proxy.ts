import { type NextRequest, NextResponse } from 'next/server';

const LANG_COOKIE = 'wk_lang';

/** Elige idioma para "/": preferencia guardada, luego Accept-Language, luego español. */
function pickLang(request: NextRequest): 'es' | 'en' {
  const saved = request.cookies.get(LANG_COOKIE)?.value;
  if (saved === 'es' || saved === 'en') return saved;

  const header = request.headers.get('accept-language') ?? '';
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { lang: tag.toLowerCase().slice(0, 2), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang === 'es' || x.lang === 'en')
    .sort((a, b) => b.q - a.q);
  return (ranked[0]?.lang as 'es' | 'en') ?? 'es';
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = `/${pickLang(request)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/',
};
