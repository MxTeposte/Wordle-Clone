import { DISPLAY_ORDER, isoToDigits } from './dates';
import { GAMES } from './games';
import type { GameId, GuessRecord, Lang, TileResult } from './types';

export type ShareInput = {
  game: GameId;
  lang: Lang;
  gameLabel: string;
  practiceLabel: string;
  puzzleNumber?: number;
  guesses: GuessRecord[];
  won: boolean;
  hardMode: boolean;
  dateHints: boolean;
  highContrast: boolean;
};

export function buildShareText(input: ShareInput): string {
  const def = GAMES[input.game];
  const emoji: Record<TileResult, string> = input.highContrast
    ? { correct: '🟧', present: '🟦', absent: '⬛' }
    : { correct: '🟩', present: '🟨', absent: '⬛' };

  const score = `${input.won ? input.guesses.length : 'X'}/${def.maxAttempts}${input.hardMode && def.kind === 'word' ? '*' : ''}`;
  const id = input.puzzleNumber ? `#${input.puzzleNumber}` : `(${input.practiceLabel})`;
  const flags = def.kind === 'date' && input.dateHints ? ' ↕' : '';
  const header = `Wordkstate ${input.gameLabel} ${id} ${score}${flags}`;

  const rows = input.guesses.map((g) => {
    if (def.kind === 'word') return g.result.map((r) => emoji[r]).join('');
    // Fecha: casillas en el orden visual del idioma, agrupadas por campo.
    const order = DISPLAY_ORDER[input.lang];
    const tiles = order.map((i) => emoji[g.result[i]]);
    return `${tiles.slice(0, 2).join('')} ${tiles.slice(2, 4).join('')} ${tiles.slice(4).join('')}`;
  });
  return [header, '', ...rows].join('\n');
}

/** Dígitos de una fecha ISO en orden visual (para mostrar). */
export const displayDigits = (iso: string, lang: Lang) => {
  const d = isoToDigits(iso);
  return DISPLAY_ORDER[lang].map((i) => d[i]);
};
