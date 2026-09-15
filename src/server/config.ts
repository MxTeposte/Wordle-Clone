import 'server-only';
import { isValidISODate } from '@/lib/dates';

const DEV_WORD_SEED = 'wordkstate-dev-seed';
const DEV_GAME_SECRET = 'wordkstate-dev-secret';
export const DEFAULT_START_DATE = '2026-09-15';

let warned = false;

/** Configuración del servidor a partir de variables de entorno (con valores de desarrollo). */
export function getServerConfig() {
  const wordSeed = process.env.WORD_SEED || DEV_WORD_SEED;
  const gameSecret = process.env.GAME_SECRET || DEV_GAME_SECRET;
  const startDate = getStartDate();

  if (!warned && process.env.NODE_ENV === 'production' && (!process.env.WORD_SEED || !process.env.GAME_SECRET)) {
    warned = true;
    console.warn(
      '[wordkstate] WORD_SEED o GAME_SECRET no están definidos: se usan valores de desarrollo y las soluciones son predecibles.',
    );
  }
  return { wordSeed, gameSecret, startDate };
}

/** Fecha del reto #1. No es secreta: también se pasa al cliente para numerar los retos. */
export function getStartDate(): string {
  const value = process.env.START_DATE;
  return value && isValidISODate(value) ? value : DEFAULT_START_DATE;
}
