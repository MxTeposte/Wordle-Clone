'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDictionary, otherLang } from '@/i18n';
import {
  daysBetween,
  digitsToISO,
  DISPLAY_ORDER,
  formatDate,
  formatLongDate,
  partialDateProblem,
  todayLocal,
} from '@/lib/dates';
import { gamePath, GAMES } from '@/lib/games';
import { hardModeViolation } from '@/lib/hard-mode';
import { normalizeKey } from '@/lib/normalize';
import { buildShareText } from '@/lib/share';
import { emptyStats, recordResult, type Stats, visibleStreak } from '@/lib/stats';
import { keys, pruneOldGames, readJSON, type SavedGame, writeJSON } from '@/lib/storage';
import type { DateHints, GameId, Lang, Mode, TileResult } from '@/lib/types';
import { DateBoard, revealDuration, WordBoard } from './Boards';
import { Countdown, HelpDialog, SettingsDialog, StatsDialog } from './Dialogs';
import { Header } from './Header';
import { ShareIcon } from './Icons';
import { keyStates, LetterKeyboard, NumericKeyboard } from './Keyboards';
import { usePrefs } from './PrefsProvider';
import { ToastList, useToasts } from './Toasts';

type Props = { lang: Lang; gameId: GameId; mode: Mode; startDate: string };

type GuessApiResponse =
  | { valid: true; result: TileResult[]; hints?: DateHints; solved: boolean }
  | { valid: false; reason: string }
  | { error: string };

const SEEN_HELP_KEY = 'wordkstate:seen-help';

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, data };
}

export function GameScreen({ lang, gameId, mode, startDate }: Props) {
  const t = getDictionary(lang);
  const def = GAMES[gameId];
  const isDate = def.kind === 'date';
  const emptyInput = useCallback(() => (isDate ? new Array<string>(8).fill('') : []), [isDate]);

  const { prefs, loaded: prefsLoaded, setPrefs } = usePrefs();
  const { toasts, show } = useToasts();

  const [date, setDate] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const [input, setInput] = useState<string[]>(emptyInput);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [bounceRow, setBounceRow] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<'help' | 'stats' | 'settings' | null>(null);
  const [stats, setStats] = useState<Stats>(() => emptyStats(def.maxAttempts));
  const [announcement, setAnnouncement] = useState('');

  const storageKey = mode === 'daily' ? (date ? keys.daily(gameId, lang, date) : null) : keys.practice(gameId, lang);
  const playing = saved?.status === 'playing';

  const persist = useCallback(
    (next: SavedGame, key = storageKey) => {
      setSaved(next);
      if (key) writeJSON(key, next);
    },
    [storageKey],
  );

  const baseRequest = useCallback(
    (game: SavedGame, dailyDate: string | null) =>
      mode === 'daily'
        ? { game: gameId, lang, mode, date: dailyDate, hints: game.dateHints }
        : { game: gameId, lang, mode, token: game.token },
    [gameId, lang, mode],
  );

  const displaySolution = useCallback(
    (solution: string) => (isDate ? `${formatDate(solution, lang)} (${formatLongDate(solution, lang)})` : solution),
    [isDate, lang],
  );

  // -------------------------------------------------------------------------
  // Fin de partida: revelar solución, registrar estadísticas y mostrar resumen.
  // -------------------------------------------------------------------------
  const finish = useCallback(
    async (game: SavedGame, dailyDate: string | null, key: string | null, quiet = false) => {
      const won = game.status === 'won';
      if (won && !quiet) {
        setBounceRow(game.guesses.length - 1);
        show(t.game.winMessages[Math.min(game.guesses.length, t.game.winMessages.length) - 1], 2200);
      }
      let next: SavedGame = { ...game };
      if (!next.solution) {
        try {
          const { ok, data } = await post<{ display?: string; puzzleNumber?: number }>('/api/reveal', {
            ...baseRequest(game, dailyDate),
            guesses: game.guesses.map((g) => g.value),
          });
          if (ok && data.display) next = { ...next, solution: data.display, puzzleNumber: data.puzzleNumber ?? next.puzzleNumber };
        } catch {
          // Sin conexión: la solución se pedirá de nuevo al volver.
        }
      }
      if (mode === 'daily' && dailyDate && !next.statsRecorded) {
        const statsKey = keys.stats(gameId, lang, game.dateHints);
        const updated = recordResult(
          readJSON<Stats>(statsKey) ?? emptyStats(def.maxAttempts),
          dailyDate,
          won,
          game.guesses.length,
          def.maxAttempts,
        );
        writeJSON(statsKey, updated);
        setStats(updated);
        next.statsRecorded = true;
      }
      setSaved(next);
      if (key) writeJSON(key, next);
      if (quiet) return;
      if (!won && next.solution) show(`${t.game.solutionWas}: ${displaySolution(next.solution)}`, 4500);
      window.setTimeout(
        () => {
          setBounceRow(null);
          setDialog('stats');
        },
        won ? 1800 : 1400,
      );
    },
    [baseRequest, def.maxAttempts, displaySolution, gameId, lang, mode, show, t],
  );

  // -------------------------------------------------------------------------
  // Carga de la partida
  // -------------------------------------------------------------------------
  const newPractice = useCallback(
    async (hints = prefs.dateHints) => {
      setBusy(true);
      try {
        const { ok, data } = await post<{ token?: string; maxDate?: string }>('/api/practice/new', {
          game: gameId,
          lang,
          hints,
        });
        if (!ok || !data.token) throw new Error('practice');
        persist(
          {
            guesses: [],
            status: 'playing',
            hardMode: prefs.hardMode,
            dateHints: isDate && hints,
            token: data.token,
            maxDate: data.maxDate,
          },
          keys.practice(gameId, lang),
        );
        setInput(emptyInput());
        setDialog(null);
      } catch {
        show(t.game.networkError);
      } finally {
        setBusy(false);
      }
    },
    [emptyInput, gameId, isDate, lang, persist, prefs.dateHints, prefs.hardMode, show, t],
  );

  const load = useCallback(async () => {
    setInput(emptyInput());
    setRevealRow(null);
    if (mode === 'daily') {
      const local = todayLocal();
      const today = local < startDate ? startDate : local;
      pruneOldGames(today);
      const key = keys.daily(gameId, lang, today);
      const existing = readJSON<SavedGame>(key);
      const game: SavedGame = existing ?? {
        guesses: [],
        status: 'playing',
        hardMode: prefs.hardMode,
        dateHints: isDate && prefs.dateHints,
        maxDate: today,
        puzzleNumber: daysBetween(startDate, today) + 1,
      };
      setDate(today);
      setSaved(game);
      if (game.status !== 'playing' && (!game.solution || !game.statsRecorded)) await finish(game, today, key, true);
    } else {
      const existing = readJSON<SavedGame>(keys.practice(gameId, lang));
      if (existing?.token) {
        setSaved(existing);
        if (existing.status !== 'playing' && !existing.solution) await finish(existing, null, keys.practice(gameId, lang), true);
      } else {
        await newPractice();
      }
    }
  }, [emptyInput, finish, gameId, isDate, lang, mode, newPractice, prefs.dateHints, prefs.hardMode, startDate]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!prefsLoaded) return;
    void loadRef.current();
    if (!readJSON<boolean>(SEEN_HELP_KEY)) {
      writeJSON(SEEN_HELP_KEY, true);
      // Primera visita: se muestran las reglas (dato de localStorage, solo tras montar).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDialog('help');
    }
  }, [prefsLoaded, gameId, lang, mode]);

  // Estadísticas visibles (dependen de si la partida de fecha usa flechas).
  const statsKey = keys.stats(gameId, lang, saved?.dateHints ?? false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(readJSON<Stats>(statsKey) ?? emptyStats(def.maxAttempts));
  }, [statsKey, def.maxAttempts, saved?.statsRecorded]);

  // Cambio de día con la pestaña abierta.
  const checkDayChange = useCallback(() => {
    if (mode === 'daily' && date && todayLocal() > date) void loadRef.current();
  }, [mode, date]);
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && checkDayChange();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [checkDayChange]);

  // -------------------------------------------------------------------------
  // Entrada
  // -------------------------------------------------------------------------
  const canType = Boolean(saved && playing && !busy && revealRow === null);

  const fail = useCallback(
    (message: string) => {
      show(message);
      setShake(true);
      window.setTimeout(() => setShake(false), 520);
    },
    [show],
  );

  const addSymbol = useCallback(
    (symbol: string) => {
      if (!canType) return;
      setInput((prev) => {
        if (!isDate) return prev.length < def.length ? [...prev, symbol] : prev;
        const slot = DISPLAY_ORDER[lang].find((i) => !prev[i]);
        if (slot === undefined) return prev;
        const next = prev.slice();
        next[slot] = symbol;
        return next;
      });
    },
    [canType, def.length, isDate, lang],
  );

  const removeSymbol = useCallback(() => {
    if (!canType) return;
    setInput((prev) => {
      if (!isDate) return prev.slice(0, -1);
      const slot = [...DISPLAY_ORDER[lang]].reverse().find((i) => prev[i]);
      if (slot === undefined) return prev;
      const next = prev.slice();
      next[slot] = '';
      return next;
    });
  }, [canType, isDate, lang]);

  const reasonMessage = useCallback(
    (reason: string) =>
      ({
        not_in_word_list: t.game.notInWordList,
        wrong_length: t.game.notEnoughLetters,
        incomplete: t.game.notEnoughDigits,
        invalid_date: t.game.invalidDate,
        before_1900: t.game.before1900,
        future_date: t.game.futureDate,
      })[reason] ?? t.game.networkError,
    [t],
  );

  const submit = useCallback(async () => {
    if (!saved || !canType) return;
    let value: string;

    if (isDate) {
      if (input.some((d) => !d)) return fail(t.game.notEnoughDigits);
      const problem = partialDateProblem(input, saved.maxDate ?? date ?? todayLocal());
      if (problem) return fail(reasonMessage(problem));
      value = digitsToISO(input.join(''));
    } else {
      if (input.length < def.length) return fail(t.game.notEnoughLetters);
      if (saved.hardMode) {
        const v = hardModeViolation(input, saved.guesses);
        if (v) return fail(v.kind === 'green' ? t.game.hardGreen(v.position, v.letter) : t.game.hardYellow(v.letter));
      }
      value = input.join('');
    }

    setBusy(true);
    try {
      const { ok, data } = await post<GuessApiResponse>('/api/guess', { ...baseRequest(saved, date), guess: value });
      if (!ok || 'error' in data) {
        const error = 'error' in data ? data.error : '';
        if (error === 'invalid_token') {
          show(t.game.sessionError);
          await newPractice();
        } else if (error === 'invalid_date') {
          await loadRef.current();
        } else {
          show(t.game.networkError);
        }
        return;
      }
      if (!data.valid) return fail(reasonMessage(data.reason));

      const guesses = [...saved.guesses, { value, result: data.result, ...(data.hints ? { hints: data.hints } : {}) }];
      const status = data.solved ? 'won' : guesses.length >= def.maxAttempts ? 'lost' : 'playing';
      const next: SavedGame = { ...saved, guesses, status };
      persist(next);
      setInput(emptyInput());
      setRevealRow(guesses.length - 1);

      const symbolsForAnnouncement = isDate ? value.replace(/-/g, '').split('') : Array.from(value);
      const key = storageKey;
      window.setTimeout(() => {
        setRevealRow(null);
        setAnnouncement(
          `${t.game.row(guesses.length)}: ${symbolsForAnnouncement.map((s, i) => `${s} ${t.game.tile[data.result[i]]}`).join(', ')}`,
        );
        if (status !== 'playing') void finish(next, date, key);
      }, revealDuration(def.length, def.kind));
    } catch {
      show(t.game.networkError);
    } finally {
      setBusy(false);
    }
  }, [
    baseRequest,
    canType,
    date,
    def.kind,
    def.length,
    def.maxAttempts,
    emptyInput,
    fail,
    finish,
    input,
    isDate,
    newPractice,
    persist,
    reasonMessage,
    saved,
    show,
    storageKey,
    t,
  ]);

  // Teclado físico (con referencias actualizadas para no re-suscribir en cada tecla).
  const handlers = useRef({ submit, addSymbol, removeSymbol });
  useEffect(() => {
    handlers.current = { submit, addSymbol, removeSymbol };
  }, [submit, addSymbol, removeSymbol]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.repeat && e.key === 'Enter')) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        void handlers.current.submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlers.current.removeSymbol();
      } else {
        const symbol = isDate ? (/^\d$/.test(e.key) ? e.key : null) : normalizeKey(e.key, lang);
        if (symbol) handlers.current.addSymbol(symbol);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDate, lang]);

  // -------------------------------------------------------------------------
  // Ajustes con bloqueos del plan
  // -------------------------------------------------------------------------
  const onPrefsChange = useCallback(
    (patch: Parameters<typeof setPrefs>[0]) => {
      const started = Boolean(saved && saved.status === 'playing' && saved.guesses.length > 0);
      if (patch.dateHints !== undefined && isDate && started) return show(t.settings.lockedHints);
      if (patch.hardMode === true && !isDate && started) return show(t.settings.lockedHard);
      setPrefs(patch);
      if (!saved || saved.status !== 'playing') return;
      if (patch.hardMode !== undefined && !isDate) persist({ ...saved, hardMode: patch.hardMode });
      if (patch.dateHints !== undefined && isDate && saved.guesses.length === 0) {
        // En práctica las flechas van dentro del token: se crea una partida nueva.
        if (mode === 'practice') void newPractice(patch.dateHints);
        else persist({ ...saved, dateHints: patch.dateHints });
      }
    },
    [isDate, mode, newPractice, persist, saved, setPrefs, show, t],
  );

  // -------------------------------------------------------------------------
  // Compartir
  // -------------------------------------------------------------------------
  const share = useCallback(async () => {
    if (!saved) return;
    const text = buildShareText({
      game: gameId,
      lang,
      gameLabel: t.share.game[gameId],
      practiceLabel: t.share.practice,
      puzzleNumber: mode === 'daily' ? saved.puzzleNumber : undefined,
      guesses: saved.guesses,
      won: saved.status === 'won',
      hardMode: saved.hardMode,
      dateHints: saved.dateHints,
      highContrast: prefs.highContrast,
    });
    try {
      if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
    } catch {
      // Cancelado o no disponible: se copia al portapapeles.
    }
    try {
      await navigator.clipboard.writeText(text);
      show(t.game.copied);
    } catch {
      show(text, 6000);
    }
  }, [gameId, lang, mode, prefs.highContrast, saved, show, t]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const states = useMemo(() => keyStates(saved?.guesses ?? [], def.kind), [saved?.guesses, def.kind]);
  const finished = saved && saved.status !== 'playing';
  const lastWinAttempts = saved?.status === 'won' ? saved.guesses.length : undefined;
  const subtitle = mode === 'daily' ? (saved?.puzzleNumber ? t.game.daily(saved.puzzleNumber) : '') : t.game.practiceBadge;
  const boardProps = {
    t,
    guesses: saved?.guesses ?? [],
    input,
    maxAttempts: def.maxAttempts,
    revealRow,
    bounceRow,
    shake,
    playing: Boolean(playing),
  };

  return (
    <div className="flex h-dvh flex-col">
      <Header
        lang={lang}
        t={t}
        subtitle={t.games[gameId].name}
        otherLangHref={gamePath(otherLang(lang), gameId, mode === 'practice')}
        onHelp={() => setDialog('help')}
        onStats={() => setDialog('stats')}
        onSettings={() => setDialog('settings')}
      />
      <ToastList toasts={toasts} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-between gap-2 overflow-hidden px-2 pt-3 pb-2">
        <div className="flex w-full items-center justify-center gap-3 text-sm">
          <h1 className="font-extrabold">
            {t.games[gameId].name}
            {subtitle && <span className="font-semibold text-[var(--muted)]"> · {subtitle}</span>}
          </h1>
          {mode === 'practice' && (
            <button
              type="button"
              onClick={() => void newPractice()}
              disabled={busy}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-bold hover:bg-[var(--accent-soft)] disabled:opacity-50"
            >
              {t.game.newGame}
            </button>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center" aria-busy={!saved}>
          {!saved ? (
            <p className="text-[var(--muted)]">{t.game.loading}</p>
          ) : isDate ? (
            <DateBoard {...boardProps} lang={lang} showHints={saved.dateHints} />
          ) : (
            <WordBoard {...boardProps} length={def.length} />
          )}
        </div>

        {finished ? (
          <div className="flex w-full max-w-md flex-col items-center gap-2 pb-2">
            {saved.solution && (
              <p className="text-center text-sm">
                {t.game.solutionWas}: <strong className="tracking-wide">{displaySolution(saved.solution)}</strong>
              </p>
            )}
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => void share()}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--correct)] px-4 py-3 font-extrabold text-white"
              >
                {t.game.share} <ShareIcon className="size-5" />
              </button>
              {mode === 'practice' ? (
                <button
                  type="button"
                  onClick={() => void newPractice()}
                  disabled={busy}
                  className="flex-1 rounded-full bg-[var(--accent)] px-4 py-3 font-extrabold text-white disabled:opacity-60"
                >
                  {t.game.newGame}
                </button>
              ) : (
                <Link
                  href={gamePath(lang, gameId, true)}
                  className="flex flex-1 items-center justify-center rounded-full border border-[var(--border)] px-4 py-3 font-extrabold hover:bg-[var(--accent-soft)]"
                >
                  {t.game.toPractice}
                </Link>
              )}
            </div>
          </div>
        ) : isDate ? (
          <NumericKeyboard
            t={t}
            states={states}
            onKey={addSymbol}
            onEnter={() => void submit()}
            onBackspace={removeSymbol}
            disabled={!saved}
          />
        ) : (
          <LetterKeyboard
            t={t}
            lang={lang}
            states={states}
            onKey={addSymbol}
            onEnter={() => void submit()}
            onBackspace={removeSymbol}
            disabled={!saved}
          />
        )}
      </main>

      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} t={t} game={gameId} />
      <SettingsDialog open={dialog === 'settings'} onClose={() => setDialog(null)} t={t} prefs={prefs} onChange={onPrefsChange} />
      <StatsDialog
        open={dialog === 'stats'}
        onClose={() => setDialog(null)}
        t={t}
        stats={stats}
        streak={visibleStreak(stats, date ?? todayLocal())}
        maxAttempts={def.maxAttempts}
        highlight={finished ? lastWinAttempts : undefined}
        subtitle={isDate ? (saved?.dateHints ? t.stats.withHints : t.stats.withoutHints) : `${t.games[gameId].name} · ${lang.toUpperCase()}`}
      >
        {finished && (
          <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4 text-center">
            {saved.solution && (
              <p className="text-sm">
                {t.game.solutionWas} <strong>{displaySolution(saved.solution)}</strong>
              </p>
            )}
            {mode === 'daily' && (
              <p className="text-sm text-[var(--muted)]">
                {t.game.nextPuzzle} <Countdown onDayChange={checkDayChange} />
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void share()}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[var(--correct)] px-4 py-2.5 font-extrabold text-white"
              >
                {t.game.share} <ShareIcon className="size-5" />
              </button>
              {mode === 'practice' ? (
                <button
                  type="button"
                  onClick={() => void newPractice()}
                  className="flex-1 rounded-full bg-[var(--accent)] px-4 py-2.5 font-extrabold text-white"
                >
                  {t.game.newGame}
                </button>
              ) : (
                <Link
                  href={gamePath(lang, gameId, true)}
                  className="flex flex-1 items-center justify-center rounded-full border border-[var(--border)] px-4 py-2.5 font-extrabold"
                >
                  {t.game.toPractice}
                </Link>
              )}
            </div>
          </div>
        )}
        {mode === 'practice' && (
          <p className="mt-4 text-center text-sm">
            <Link href={gamePath(lang, gameId)} className="font-bold text-[var(--accent)] underline-offset-2 hover:underline">
              {t.game.toDaily}
            </Link>
          </p>
        )}
      </StatsDialog>
    </div>
  );
}
