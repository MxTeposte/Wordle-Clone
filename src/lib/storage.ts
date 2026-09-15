'use client';

import type { GameId, GuessRecord, Lang, Mode } from './types';

export type Theme = 'system' | 'light' | 'dark';

export type Prefs = {
  theme: Theme;
  highContrast: boolean;
  hardMode: boolean;
  dateHints: boolean;
};

export const DEFAULT_PREFS: Prefs = { theme: 'system', highContrast: false, hardMode: false, dateHints: false };

export type SavedGame = {
  guesses: GuessRecord[];
  status: 'playing' | 'won' | 'lost';
  hardMode: boolean;
  dateHints: boolean;
  /** Práctica: token cifrado de la partida. */
  token?: string;
  /** Límite superior de fechas (juego de fecha). */
  maxDate?: string;
  /** Solución revelada al terminar (forma para mostrar). */
  solution?: string;
  puzzleNumber?: number;
  statsRecorded?: boolean;
};

export const keys = {
  prefs: 'wordkstate:prefs',
  daily: (game: GameId, lang: Lang, date: string) =>
    game === 'date' ? `wordkstate:date:daily:${date}` : `wordkstate:${game}:${lang}:daily:${date}`,
  practice: (game: GameId, lang: Lang) =>
    game === 'date' ? 'wordkstate:date:practice' : `wordkstate:${game}:${lang}:practice`,
  /** Estadísticas separadas por modo; las del reto diario conservan las claves originales. */
  stats: (game: GameId, lang: Lang, dateHints: boolean, mode: Mode = 'daily') => {
    const base = game === 'date' ? `date:${dateHints ? 'hints' : 'plain'}` : `${game}:${lang}`;
    return mode === 'practice' ? `wordkstate:stats:practice:${base}` : `wordkstate:stats:${base}`;
  },
};

export function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Almacenamiento no disponible (modo privado, cuota): el juego sigue funcionando sin guardar.
  }
}

/** Elimina partidas diarias antiguas para no llenar el almacenamiento. */
export function pruneOldGames(today: string, keepDays = 14): void {
  try {
    const limit = new Date(`${today}T00:00:00Z`).getTime() - keepDays * 86_400_000;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      const m = key?.match(/:daily:(\d{4}-\d{2}-\d{2})$/);
      if (key && m && new Date(`${m[1]}T00:00:00Z`).getTime() < limit) window.localStorage.removeItem(key);
    }
  } catch {
    // Ignorar.
  }
}
