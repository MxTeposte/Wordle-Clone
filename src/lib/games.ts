import type { GameId, Lang, WordLength } from './types';

/** Definición pública (cliente y servidor) de cada juego. */
export type GameDefinition = {
  id: GameId;
  /** Casillas por fila. */
  length: number;
  maxAttempts: number;
  kind: 'word' | 'date';
  /** Slug de URL por idioma. */
  slug: Record<Lang, string>;
};

export const GAMES: Record<GameId, GameDefinition> = {
  w5: { id: 'w5', length: 5, maxAttempts: 6, kind: 'word', slug: { es: '5', en: '5' } },
  w6: { id: 'w6', length: 6, maxAttempts: 7, kind: 'word', slug: { es: '6', en: '6' } },
  // Intentos iniciales del juego de fecha: se ajustan tras las pruebas de juego (plan §6.3).
  date: { id: 'date', length: 8, maxAttempts: 6, kind: 'date', slug: { es: 'fecha', en: 'date' } },
};

export const GAME_LIST: GameDefinition[] = [GAMES.w5, GAMES.w6, GAMES.date];

export const wordLengthOf = (game: GameId): WordLength => (game === 'w6' ? 6 : 5);

export function gameFromSlug(lang: Lang, slug: string): GameDefinition | null {
  return GAME_LIST.find((g) => g.slug[lang] === slug) ?? null;
}

export const PRACTICE_SLUG: Record<Lang, string> = { es: 'practica', en: 'practice' };
export const CREDITS_SLUG: Record<Lang, string> = { es: 'creditos', en: 'credits' };

export const gamePath = (lang: Lang, game: GameId, practice = false) =>
  `/${lang}/${GAMES[game].slug[lang]}${practice ? `/${PRACTICE_SLUG[lang]}` : ''}`;
