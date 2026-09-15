export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const GAME_IDS = ['w5', 'w6', 'date'] as const;
export type GameId = (typeof GAME_IDS)[number];

export type WordLength = 5 | 6;

export type Mode = 'daily' | 'practice';

export type TileResult = 'correct' | 'present' | 'absent';

export type FieldHint = 'up' | 'down' | 'equal';
export type DateHints = { day: FieldHint; month: FieldHint; year: FieldHint };

export type GuessRecord = {
  /** Intento canónico: palabra normalizada o fecha YYYY-MM-DD. */
  value: string;
  result: TileResult[];
  hints?: DateHints;
};

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
export const isGameId = (v: unknown): v is GameId =>
  typeof v === 'string' && (GAME_IDS as readonly string[]).includes(v);
