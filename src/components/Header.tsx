'use client';

import Link from 'next/link';
import type { Dictionary } from '@/i18n';
import type { Lang } from '@/lib/types';
import { GlobeIcon, HelpIcon, Logo, SettingsIcon, StatsIcon } from './Icons';

type HeaderProps = {
  lang: Lang;
  t: Dictionary;
  subtitle?: string;
  /** Ruta equivalente en el otro idioma. */
  otherLangHref: string;
  onHelp: () => void;
  onStats?: () => void;
  onSettings: () => void;
};

const iconButton =
  'inline-flex size-10 items-center justify-center rounded-full text-[var(--fg)] hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]';

export function rememberLang(lang: Lang) {
  document.cookie = `wk_lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export function Header({ lang, t, subtitle, otherLangHref, onHelp, onStats, onSettings }: HeaderProps) {
  const other = lang === 'es' ? 'en' : 'es';
  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-3">
        <Link href={`/${lang}`} className="flex min-w-0 items-center gap-2" aria-label={`Wordkstate — ${t.nav.home}`}>
          <Logo />
          <span className="truncate text-xl font-black tracking-tight">Wordkstate</span>
          {subtitle && (
            <span className="hidden truncate rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent)] min-[420px]:inline">
              {subtitle}
            </span>
          )}
        </Link>
        <nav className="flex items-center" aria-label="Wordkstate">
          <button type="button" className={iconButton} onClick={onHelp} aria-label={t.nav.help} title={t.nav.help}>
            <HelpIcon />
          </button>
          {onStats && (
            <button type="button" className={iconButton} onClick={onStats} aria-label={t.nav.stats} title={t.nav.stats}>
              <StatsIcon />
            </button>
          )}
          <button
            type="button"
            className={iconButton}
            onClick={onSettings}
            aria-label={t.nav.settings}
            title={t.nav.settings}
          >
            <SettingsIcon />
          </button>
          <Link
            href={otherLangHref}
            hrefLang={other}
            onClick={() => rememberLang(other)}
            className="ml-1 inline-flex h-9 items-center gap-1 rounded-full border border-[var(--border)] px-2.5 text-sm font-bold hover:bg-[var(--accent-soft)]"
            aria-label={`${t.nav.language}: ${t.nav.switchTo}`}
          >
            <GlobeIcon className="size-4" />
            {other.toUpperCase()}
          </Link>
        </nav>
      </div>
    </header>
  );
}
