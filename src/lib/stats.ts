import { daysBetween } from './dates';

export type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribution[i] = partidas ganadas en i + 1 intentos. */
  distribution: number[];
  /** Fecha (ISO) del último reto diario terminado. */
  lastDate?: string;
  /** ¿Se ganó el último reto terminado? */
  lastWon?: boolean;
};

export const emptyStats = (maxAttempts: number): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: new Array(maxAttempts).fill(0),
});

/**
 * Registra un reto diario terminado. La racha continúa si el anterior reto
 * ganado fue el día inmediatamente anterior. Es idempotente por fecha.
 */
export function recordResult(stats: Stats, date: string, won: boolean, attempts: number, maxAttempts: number): Stats {
  if (stats.lastDate === date) return stats;
  const distribution = Array.from({ length: maxAttempts }, (_, i) => stats.distribution[i] ?? 0);
  if (won) distribution[attempts - 1] += 1;

  const continues = stats.lastDate !== undefined && stats.lastWon === true && daysBetween(stats.lastDate, date) === 1;
  const currentStreak = won ? (continues ? stats.currentStreak + 1 : 1) : 0;

  return {
    played: stats.played + 1,
    wins: stats.wins + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(stats.maxStreak, currentStreak),
    distribution,
    lastDate: date,
    lastWon: won,
  };
}

/** La racha visible se pierde si se saltó un día (sin modificar lo guardado). */
export function visibleStreak(stats: Stats, today: string): number {
  if (!stats.lastDate || !stats.lastWon) return 0;
  return daysBetween(stats.lastDate, today) <= 1 ? stats.currentStreak : 0;
}

export const winPercentage = (stats: Stats) => (stats.played ? Math.round((stats.wins / stats.played) * 100) : 0);
