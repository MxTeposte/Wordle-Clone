'use client';

import type { CSSProperties } from 'react';
import type { Dictionary } from '@/i18n';
import { DISPLAY_ORDER, type DateField, FIELD_ORDER } from '@/lib/dates';
import type { DateHints, GuessRecord, Lang, TileResult } from '@/lib/types';

type TileProps = {
  symbol?: string;
  state?: TileResult;
  reveal?: boolean;
  bounce?: boolean;
  pop?: boolean;
  delay?: number;
  label: string;
  style?: CSSProperties;
};

function Tile({ symbol, state, reveal, bounce, pop, delay = 0, label, style }: TileProps) {
  return (
    <div
      className="tile rounded-md"
      data-state={state}
      data-filled={symbol ? 'true' : 'false'}
      data-reveal={reveal ? 'true' : undefined}
      data-bounce={bounce ? 'true' : undefined}
      data-pop={pop ? 'true' : undefined}
      style={{ ...style, '--delay': `${delay}ms` } as CSSProperties}
      role="img"
      aria-label={label}
    >
      {symbol}
    </div>
  );
}

const tileLabel = (t: Dictionary, symbol: string | undefined, state?: TileResult) =>
  symbol ? `${symbol}${state ? `, ${t.game.tile[state]}` : ''}` : t.game.tile.empty;

export const REVEAL_STAGGER_MS = { word: 280, date: 160 };
export const revealDuration = (tiles: number, kind: 'word' | 'date') => REVEAL_STAGGER_MS[kind] * (tiles - 1) + 520;

type BoardState = {
  guesses: GuessRecord[];
  input: string[];
  maxAttempts: number;
  revealRow: number | null;
  bounceRow: number | null;
  shake: boolean;
  playing: boolean;
};

// ---------------------------------------------------------------------------
// Tablero de palabras
// ---------------------------------------------------------------------------

export function WordBoard({ t, length, ...s }: BoardState & { t: Dictionary; length: number }) {
  const size = `min(3.75rem, calc((100vw - 2rem) / ${length} - 0.375rem), calc((100dvh - 19rem) / ${s.maxAttempts} - 0.375rem))`;
  const tileStyle: CSSProperties = { width: size, fontSize: `calc(${size} * 0.5)` };

  return (
    <div className="flex flex-col items-center gap-1.5" aria-label={t.game.board}>
      {Array.from({ length: s.maxAttempts }, (_, row) => {
        const record = s.guesses[row];
        const isCurrent = s.playing && row === s.guesses.length;
        const symbols = record ? Array.from(record.value) : isCurrent ? s.input : [];
        return (
          <div
            key={row}
            role="group"
            aria-label={t.game.row(row + 1)}
            className={`flex gap-1.5 ${isCurrent && s.shake ? 'row-shake' : ''}`}
          >
            {Array.from({ length }, (_, col) => {
              const symbol = symbols[col];
              const state = record?.result[col];
              return (
                <Tile
                  key={col}
                  symbol={symbol}
                  state={state}
                  reveal={row === s.revealRow}
                  bounce={row === s.bounceRow}
                  pop={isCurrent && Boolean(symbol) && col === symbols.length - 1}
                  delay={row === s.bounceRow ? col * 100 : col * REVEAL_STAGGER_MS.word}
                  label={tileLabel(t, symbol, state)}
                  style={tileStyle}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tablero de fecha
// ---------------------------------------------------------------------------

const ARROW: Record<DateHints[DateField], string> = { up: '↑', down: '↓', equal: '=' };

export function DateBoard({ t, lang, showHints, ...s }: BoardState & { t: Dictionary; lang: Lang; showHints: boolean }) {
  const order = DISPLAY_ORDER[lang];
  const fields = FIELD_ORDER[lang];
  const rowHeight = showHints ? '1rem' : '0rem';
  // Mínimo legible de 1.75rem: en pantallas muy bajas el tablero se desplaza en lugar de encogerse.
  const size = `max(1.75rem, min(2.9rem, calc((100vw - 3.5rem) / 8 - 0.3rem), calc((100dvh - 16.5rem) / ${s.maxAttempts} - 0.25rem - ${rowHeight})))`;
  const tileStyle: CSSProperties = { width: size, fontSize: `calc(${size} * 0.5)` };
  const groups: [number, number][] = [
    [0, 2],
    [2, 4],
    [4, 8],
  ];
  const fieldLabel = (f: DateField) => (f === 'day' ? t.game.day : f === 'month' ? t.game.month : t.game.year);
  const hintLabel = (h: DateHints[DateField]) => (h === 'up' ? t.game.hintUp : h === 'down' ? t.game.hintDown : t.game.hintEqual);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-end gap-3 text-[0.7rem] font-bold uppercase tracking-wider text-[var(--muted)]" aria-hidden>
        {groups.map(([from, to], g) => (
          <span key={g} className="text-center" style={{ width: `calc(${size} * ${to - from} + 0.3rem * ${to - from - 1})` }}>
            {fieldLabel(fields[g])}
          </span>
        ))}
      </div>
      {Array.from({ length: s.maxAttempts }, (_, row) => {
        const record = s.guesses[row];
        const isCurrent = s.playing && row === s.guesses.length;
        // Dígitos en orden canónico → se muestran en el orden visual del idioma.
        const canonical = record ? record.value.replace(/-/g, '').split('') : isCurrent ? s.input : [];
        const lastTyped = isCurrent
          ? order.reduce((last, idx, pos) => (canonical[idx] ? pos : last), -1)
          : -1;
        return (
          <div
            key={row}
            role="group"
            aria-label={t.game.row(row + 1)}
            data-current-row={isCurrent || undefined}
            className={isCurrent && s.shake ? 'row-shake' : ''}
          >
            <div className="flex items-center gap-3">
              {groups.map(([from, to], g) => (
                <div key={g} className="flex flex-col items-center">
                  <div className="flex gap-[0.3rem]">
                    {order.slice(from, to).map((canonIdx, k) => {
                      const pos = from + k;
                      const symbol = canonical[canonIdx] || undefined;
                      const state = record?.result[canonIdx];
                      return (
                        <Tile
                          key={canonIdx}
                          symbol={symbol}
                          state={state}
                          reveal={row === s.revealRow}
                          bounce={row === s.bounceRow}
                          pop={isCurrent && pos === lastTyped}
                          delay={row === s.bounceRow ? pos * 70 : pos * REVEAL_STAGGER_MS.date}
                          label={tileLabel(t, symbol, state)}
                          style={tileStyle}
                        />
                      );
                    })}
                  </div>
                  {showHints && (
                    <div className="h-4 text-sm font-black leading-4 text-[var(--accent)]">
                      {record?.hints && row !== s.revealRow && (
                        <span aria-label={`${fieldLabel(fields[g])}: ${hintLabel(record.hints[fields[g]])}`}>
                          {ARROW[record.hints[fields[g]]]}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
