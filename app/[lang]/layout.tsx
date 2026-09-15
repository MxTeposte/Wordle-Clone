import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { PrefsProvider } from '@/components/PrefsProvider';
import { getDictionary } from '@/i18n';
import { isLang, LANGS } from '@/lib/types';
import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = getDictionary(lang);
  return {
    title: { default: t.meta.title, template: '%s · Wordkstate' },
    description: t.meta.description,
    applicationName: 'Wordkstate',
    alternates: { languages: { es: '/es', en: '/en' } },
    openGraph: { title: t.meta.title, description: t.meta.description, siteName: 'Wordkstate', locale: lang, type: 'website' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#121117' },
  ],
};

// Aplica tema y contraste antes del primer pintado para evitar parpadeos.
const THEME_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem('wordkstate:prefs')||'{}');var t=p.theme||'system';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.setAttribute('data-theme',t);if(p.highContrast){d.setAttribute('data-contrast','high')}}catch(e){}})();`;

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
