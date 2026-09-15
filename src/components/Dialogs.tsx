'use client';

import { useEffect, useState } from 'react';
import type { Dictionary } from '@/i18n';
import { GAMES } from '@/lib/games';
import { type Stats, winPercentage } from '@/lib/stats';
import type { Prefs, Theme } from '@/lib/storage';
import type { GameId, TileResult } from '@/lib/types';
import { Modal } from './Modal';

// ---------------------------------------------------------------------------
// Cómo jugar
// ---------------------------------------------------------------------------

function Example({ symbols, states }: { symbols: string[]; states: (TileResult | undefined)[] }) {
  return (
    <div className="my-2 flex gap-1" aria-hidden>
      {symbols.map((s, i) => (
        <div key={i} className="tile size-9 rounded-md text-lg" data-state={states[i]} data-filled="true">
          {s}
        </div>
      ))}
    </div>
  );
}

export function HelpDialog({
  open,
  onClose,
  t,
  game,
}: {
  open: boolean;
  onClose: () => void;
  t: Dictionary;
  game?: GameId;
}) {
  const showWords = game !== 'date';
  const showDate = !game || game === 'date';
  return (
    <Modal open={open} onClose={onClose} title={t.help.title} closeLabel={t.nav.close}>
      <div className="space-y-3 text-[0.95rem] leading-relaxed">
        {showWords &&
          (game ? [GAMES[game]] : [GAMES.w5, GAMES.w6]).map((g) => (
            <p key={g.id}>
              <strong>{t.games[g.id].name}.</strong> {t.help.wordIntro(g.length, g.maxAttempts)}
            </p>
          ))}
        {showDate && (
          <p>
            <strong>{t.games.date.name}.</strong> {t.help.dateIntro(GAMES.date.maxAttempts)}
          </p>
        )}
        <p>{t.help.colors}</p>
        <div>
          <Example symbols={['P', 'L', 'A', 'Z', 'A']} states={['correct']} />
          <p className="text-sm">
            <strong>P</strong> {t.help.correct}
          </p>
          <Example symbols={['M', 'U', 'N', 'D', 'O']} states={[undefined, undefined, 'present']} />
          <p className="text-sm">
            <strong>N</strong> {t.help.present}
          </p>
          <Example symbols={['1', '9', '6', '9']} states={[undefined, undefined, undefined, 'absent']} />
          <p className="text-sm">
            <strong>9</strong> {t.help.absent}
          </p>
        </div>
        {showDate && <p className="text-sm">{t.help.hints}</p>}
        <p className="border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">{t.help.daily}</p>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

export function StatsDialog({
  open,
  onClose,
  t,
  stats,
  streak,
  maxAttempts,
  highlight,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  t: Dictionary;
  stats: Stats;
  streak: number;
  maxAttempts: number;
  /** Intentos de la última partida ganada, para resaltar su barra. */
  highlight?: number;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const max = Math.max(1, ...stats.distribution);
  const numbers = [
    [stats.played, t.stats.played],
    [winPercentage(stats), t.stats.winPct],
    [streak, t.stats.currentStreak],
    [stats.maxStreak, t.stats.maxStreak],
  ] as const;

  return (
    <Modal open={open} onClose={onClose} title={t.stats.title} closeLabel={t.nav.close}>
      {subtitle && <p className="-mt-3 mb-4 text-sm font-semibold text-[var(--muted)]">{subtitle}</p>}
      <dl className="grid grid-cols-4 gap-2 text-center">
        {numbers.map(([value, label]) => (
          <div key={label}>
            <dd className="text-3xl font-black tabular-nums">{value}</dd>
            <dt className="text-xs leading-tight text-[var(--muted)]">{label}</dt>
          </div>
        ))}
      </dl>
      <h3 className="mt-5 mb-2 text-sm font-extrabold uppercase tracking-wide">{t.stats.distribution}</h3>
      {stats.played === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t.stats.none}</p>
      ) : (
        <ol className="space-y-1">
          {Array.from({ length: maxAttempts }, (_, i) => {
            const count = stats.distribution[i] ?? 0;
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-right font-bold tabular-nums">{i + 1}</span>
                <span
                  className="flex h-6 min-w-7 items-center justify-end rounded px-2 font-bold text-white tabular-nums"
                  style={{
                    width: `${Math.max(7, (count / max) * 100)}%`,
                    background: highlight === i + 1 ? 'var(--correct)' : 'var(--absent)',
                  }}
                >
                  {count}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {children}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 border-b border-[var(--border)] py-3">
      <span>
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-[var(--muted)]">{description}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="relative mt-1 h-6 w-11 shrink-0 rounded-full bg-[var(--tile-empty)] transition-colors peer-checked:bg-[var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--accent)] after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
      />
    </label>
  );
}

export function SettingsDialog({
  open,
  onClose,
  t,
  prefs,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  t: Dictionary;
  prefs: Prefs;
  /** Devuelve false si el cambio no está permitido en la partida actual. */
  onChange: (patch: Partial<Prefs>) => void;
}) {
  const themes: Theme[] = ['system', 'light', 'dark'];
  return (
    <Modal open={open} onClose={onClose} title={t.settings.title} closeLabel={t.nav.close}>
      <Toggle
        label={t.settings.hardMode}
        description={t.settings.hardModeDesc}
        checked={prefs.hardMode}
        onChange={(v) => onChange({ hardMode: v })}
      />
      <Toggle
        label={t.settings.dateHints}
        description={t.settings.dateHintsDesc}
        checked={prefs.dateHints}
        onChange={(v) => onChange({ dateHints: v })}
      />
      <Toggle
        label={t.settings.highContrast}
        description={t.settings.highContrastDesc}
        checked={prefs.highContrast}
        onChange={(v) => onChange({ highContrast: v })}
      />
      <fieldset className="py-3">
        <legend className="mb-2 font-bold">{t.settings.theme}</legend>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((theme) => (
            <label
              key={theme}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-2 text-center text-sm font-semibold has-checked:border-[var(--accent)] has-checked:bg-[var(--accent-soft)] has-focus-visible:outline-2 has-focus-visible:outline-[var(--accent)]"
            >
              <input
                type="radio"
                name="theme"
                value={theme}
                className="sr-only"
                checked={prefs.theme === theme}
                onChange={() => onChange({ theme })}
              />
              {t.settings.themes[theme]}
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Cuenta regresiva hasta la medianoche local
// ---------------------------------------------------------------------------

function msToMidnight() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function Countdown({ onDayChange }: { onDayChange?: () => void }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const left = msToMidnight();
      setMs(left);
      if (left < 1000) onDayChange?.();
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [onDayChange]);

  if (ms === null) return <span className="tabular-nums">--:--:--</span>;
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="tabular-nums">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  );
}
