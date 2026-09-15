'use client';

import type { Dictionary } from '@/i18n';
import type { Lang, TileResult } from '@/lib/types';
import { BackspaceIcon } from './Icons';

const LAYOUTS: Record<Lang, string[][]> = {
  en: ['QWERTYUIOP'.split(''), 'ASDFGHJKL'.split(''), ['ENTER', ...'ZXCVBNM'.split(''), 'BACK']],
  es: ['QWERTYUIOP'.split(''), 'ASDFGHJKLÑ'.split(''), ['ENTER', ...'ZXCVBNM'.split(''), 'BACK']],
};

type KeyboardProps = {
  t: Dictionary;
  states: Map<string, TileResult>;
  onKey: (key: string) => void;
  onEnter: () => void;
  onBackspace: () => void;
  disabled?: boolean;
};

function Key({
  label,
  ariaLabel,
  state,
  wide,
  onClick,
  disabled,
}: {
  label: React.ReactNode;
  ariaLabel?: string;
  state?: TileResult;
  wide?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`key h-14 text-base ${wide ? 'flex-[1.5] px-1 text-xs' : 'flex-1'} min-w-0`}
      data-state={state}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      // Evita que el botón quede enfocado y Enter del teclado físico lo "pulse" de nuevo.
      onMouseDown={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

export function LetterKeyboard({ t, lang, states, onKey, onEnter, onBackspace, disabled }: KeyboardProps & { lang: Lang }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-1.5 px-1.5" role="group" aria-label={t.game.keyboard}>
      {LAYOUTS[lang].map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {i === 1 && lang === 'en' && <div className="flex-[0.5]" />}
          {row.map((key) =>
            key === 'ENTER' ? (
              <Key key={key} label={t.game.enter} wide onClick={onEnter} disabled={disabled} />
            ) : key === 'BACK' ? (
              <Key
                key={key}
                label={<BackspaceIcon />}
                ariaLabel={t.game.backspace}
                wide
                onClick={onBackspace}
                disabled={disabled}
              />
            ) : (
              <Key key={key} label={key} state={states.get(key)} onClick={() => onKey(key)} disabled={disabled} />
            ),
          )}
          {i === 1 && lang === 'en' && <div className="flex-[0.5]" />}
        </div>
      ))}
    </div>
  );
}

export function NumericKeyboard({ t, states, onKey, onEnter, onBackspace, disabled }: KeyboardProps) {
  const rows = ['12345'.split(''), '67890'.split('')];
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-1.5 px-1.5" role="group" aria-label={t.game.keyboard}>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1.5">
          {row.map((key) => (
            <Key key={key} label={key} state={states.get(key)} onClick={() => onKey(key)} disabled={disabled} />
          ))}
        </div>
      ))}
      <div className="flex gap-1.5">
        <Key label={t.game.enter} onClick={onEnter} disabled={disabled} />
        <Key label={<BackspaceIcon />} ariaLabel={t.game.backspace} onClick={onBackspace} disabled={disabled} />
      </div>
    </div>
  );
}

const RANK: Record<TileResult, number> = { absent: 0, present: 1, correct: 2 };

/** Mejor estado conocido de cada símbolo a partir de los intentos. */
export function keyStates(guesses: { value: string; result: TileResult[] }[], kind: 'word' | 'date'): Map<string, TileResult> {
  const map = new Map<string, TileResult>();
  for (const g of guesses) {
    const symbols = kind === 'date' ? g.value.replace(/-/g, '').split('') : Array.from(g.value);
    symbols.forEach((s, i) => {
      const prev = map.get(s);
      const next = g.result[i];
      if (!prev || RANK[next] > RANK[prev]) map.set(s, next);
    });
  }
  return map;
}
