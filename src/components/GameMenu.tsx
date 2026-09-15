'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getDictionary, otherLang } from '@/i18n';
import { AUTHOR, BUILT_WITH } from '@/lib/author';
import { todayLocal } from '@/lib/dates';
import { CREDITS_SLUG, GAME_LIST, gamePath } from '@/lib/games';
import { keys, readJSON, type SavedGame } from '@/lib/storage';
import type { GameId, Lang, TileResult } from '@/lib/types';
import { HelpDialog, SettingsDialog } from './Dialogs';
import { Header } from './Header';
import { usePrefs } from './PrefsProvider';

type Status = 'pending' | 'playing' | 'won' | 'lost';

const PREVIEW: Record<GameId, { symbols: string[]; states: TileResult[] }> = {
  w5: { symbols: ['J', 'U', 'E', 'G', 'O'], states: ['correct', 'absent', 'present', 'absent', 'correct'] },
  w6: { symbols: ['P', 'A', 'L', 'A', 'B', 'R'], states: ['absent', 'correct', 'present', 'absent', 'absent', 'correct'] },
  date: { symbols: ['1', '5', '0', '9', '2', '0'], states: ['correct', 'present', 'absent', 'correct', 'absent', 'present'] },
};

const STATUS_COLOR: Record<Status, string> = {
  won: 'text-[var(--correct)]',
  lost: 'text-[var(--muted)]',
  playing: 'text-[var(--present)]',
  pending: 'text-[var(--accent)]',
};

export function GameMenu({ lang, startDate }: { lang: Lang; startDate: string }) {
  const t = getDictionary(lang);
  const { prefs, setPrefs } = usePrefs();
  const [dialog, setDialog] = useState<'help' | 'settings' | null>(null);
  const [statuses, setStatuses] = useState<Partial<Record<GameId, Status>>>({});

  useEffect(() => {
    const local = todayLocal();
    const today = local < startDate ? startDate : local;
    const next: Partial<Record<GameId, Status>> = {};
    for (const g of GAME_LIST) {
      const game = readJSON<SavedGame>(keys.daily(g.id, lang, today));
      next[g.id] = !game || (game.status === 'playing' && !game.guesses.length) ? 'pending' : game.status;
    }
    // Estado leído de localStorage tras montar (no existe durante el render estático).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatuses(next);
  }, [lang, startDate]);

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        lang={lang}
        t={t}
        otherLangHref={`/${otherLang(lang)}`}
        onHelp={() => setDialog('help')}
        onSettings={() => setDialog('settings')}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Wordkstate</h1>
        <p className="mt-1 text-[var(--muted)]">{t.menu.tagline}</p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {GAME_LIST.map((g) => {
            const status = statuses[g.id];
            const preview = PREVIEW[g.id];
            return (
              <li key={g.id} className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <div className="mb-3 flex gap-1" aria-hidden>
                  {preview.symbols.map((s, i) => (
                    <span key={i} className="tile size-7 rounded text-sm" data-state={preview.states[i]}>
                      {s}
                    </span>
                  ))}
                </div>
                <h2 className="text-lg font-extrabold">{t.games[g.id].name}</h2>
                <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{t.games[g.id].description(g.maxAttempts)}</p>
                <p className="mt-3 h-4 text-xs font-bold uppercase tracking-wide">
                  {status && <span className={STATUS_COLOR[status]}>{t.menu.status[status]}</span>}
                </p>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={gamePath(lang, g.id)}
                    className="flex-1 rounded-full bg-[var(--accent)] px-3 py-2 text-center text-sm font-extrabold text-white hover:brightness-110"
                  >
                    {t.menu.play}
                  </Link>
                  <Link
                    href={gamePath(lang, g.id, true)}
                    className="flex-1 rounded-full border border-[var(--border)] px-3 py-2 text-center text-sm font-bold hover:bg-[var(--accent-soft)]"
                  >
                    {t.menu.practice}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
      <footer className="mx-auto w-full max-w-3xl px-4 py-6 text-sm text-[var(--muted)]">
        <p>
          {t.menu.footer}{' '}
          <Link href={`/${lang}/${CREDITS_SLUG[lang]}`} className="font-semibold underline underline-offset-2">
            {t.nav.credits}
          </Link>
        </p>
        <p className="mt-1">
          {t.credits.madeBy}{' '}
          <span className="font-semibold">{AUTHOR.name}</span>
          {' · '}
          {t.credits.builtWith}{' '}
          <a href={BUILT_WITH.url} className="font-semibold underline underline-offset-2" rel="noopener">
            {BUILT_WITH.name}
          </a>
        </p>
      </footer>
      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} t={t} />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} t={t} prefs={prefs} onChange={setPrefs} />
    </div>
  );
}
