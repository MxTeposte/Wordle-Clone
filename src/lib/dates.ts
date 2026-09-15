import type { DateHints, FieldHint, Lang } from './types';

/** Primer día válido del juego de fecha. */
export const MIN_DATE = '1900-01-01';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateParts = { year: number; month: number; day: number };

export const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Interpreta YYYY-MM-DD; devuelve null si el formato o la fecha no son válidos. */
export function parseISODate(value: string): DateParts | null {
  const m = ISO_RE.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export const isValidISODate = (value: string) => parseISODate(value) !== null;

const pad = (n: number, len = 2) => String(n).padStart(len, '0');

export const toISO = ({ year, month, day }: DateParts) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

/** Días desde la época Unix (en UTC) para una fecha ISO válida. */
export function toEpochDay(iso: string): number {
  const p = parseISODate(iso);
  if (!p) throw new Error(`Fecha inválida: ${iso}`);
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS);
}

export function fromEpochDay(day: number): string {
  const d = new Date(day * DAY_MS);
  return toISO({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
}

export const daysBetween = (fromISO: string, toISO_: string) => toEpochDay(toISO_) - toEpochDay(fromISO);

export const addDays = (iso: string, days: number) => fromEpochDay(toEpochDay(iso) + days);

/** Fecha UTC actual en ISO. */
export const todayUTC = (now = new Date()) =>
  toISO({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() });

/** Fecha local del navegador/servidor en ISO. */
export const todayLocal = (now = new Date()) =>
  toISO({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });

// ---------------------------------------------------------------------------
// Juego de fecha: 8 dígitos en orden canónico YYYYMMDD.
// ---------------------------------------------------------------------------

export const DATE_LENGTH = 8;

export const isoToDigits = (iso: string) => iso.replace(/-/g, '');
export const digitsToISO = (digits: string) => `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;

export type DateField = 'day' | 'month' | 'year';

/**
 * Orden visual de las 8 casillas según el idioma. Cada elemento es el índice
 * de la casilla en el orden canónico YYYYMMDD.
 *   es: DD MM AAAA → [6,7, 4,5, 0,1,2,3]
 *   en: MM DD YYYY → [4,5, 6,7, 0,1,2,3]
 */
export const DISPLAY_ORDER: Record<Lang, number[]> = {
  es: [6, 7, 4, 5, 0, 1, 2, 3],
  en: [4, 5, 6, 7, 0, 1, 2, 3],
};

export const FIELD_ORDER: Record<Lang, DateField[]> = {
  es: ['day', 'month', 'year'],
  en: ['month', 'day', 'year'],
};

export const fieldOfCanonicalIndex = (i: number): DateField => (i < 4 ? 'year' : i < 6 ? 'month' : 'day');

export type DateGuessError = 'incomplete' | 'invalid_date' | 'before_1900' | 'future_date';

/** Valida un intento de fecha (ISO) contra el rango [1900-01-01, maxDate]. */
export function checkDateGuess(iso: string, maxDate: string): DateGuessError | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'incomplete';
  if (!isValidISODate(iso)) return 'invalid_date';
  if (iso < MIN_DATE) return 'before_1900';
  if (iso > maxDate) return 'future_date';
  return null;
}

/**
 * Validación parcial mientras el jugador escribe (dígitos en orden canónico,
 * posiciones vacías como ''). Detecta imposibles antes de enviar.
 */
export function partialDateProblem(canonical: readonly string[], maxDate: string): DateGuessError | null {
  const get = (from: number, to: number) => canonical.slice(from, to).join('');
  const year = get(0, 4);
  const month = get(4, 6);
  const day = get(6, 8);
  const maxYear = Number(maxDate.slice(0, 4));

  if (year.length >= 2 && year.slice(0, 2) < '19') return 'before_1900';
  if (year.length >= 2 && year.slice(0, 2) > '20') return 'future_date';
  if (year.length === 4 && Number(year) > maxYear) return 'future_date';
  if (month.length === 2 && (Number(month) < 1 || Number(month) > 12)) return 'invalid_date';
  if (day.length === 2 && (Number(day) < 1 || Number(day) > 31)) return 'invalid_date';
  if (year.length === 4 && month.length === 2 && day.length === 2) {
    return checkDateGuess(`${year}-${month}-${day}`, maxDate);
  }
  if (month.length === 2 && day.length === 2 && Number(day) > daysInMonth(2000, Number(month))) return 'invalid_date';
  return null;
}

const compare = (guess: number, solution: number): FieldHint =>
  solution > guess ? 'up' : solution < guess ? 'down' : 'equal';

/** Flechas por campo: indican si el valor real es mayor (up), menor (down) o igual. */
export function dateHints(guessISO: string, solutionISO: string): DateHints {
  const g = parseISODate(guessISO)!;
  const s = parseISODate(solutionISO)!;
  return { day: compare(g.day, s.day), month: compare(g.month, s.month), year: compare(g.year, s.year) };
}

/** Fecha aleatoria uniforme en [MIN_DATE, maxDate]. */
export function randomDate(rng: () => number, maxDate: string): string {
  const from = toEpochDay(MIN_DATE);
  const span = toEpochDay(maxDate) - from + 1;
  return fromEpochDay(from + Math.floor(rng() * span));
}

/** Formatea una fecha ISO para mostrar según el idioma. */
export function formatDate(iso: string, lang: Lang): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  return lang === 'es' ? `${pad(p.day)}/${pad(p.month)}/${p.year}` : `${pad(p.month)}/${pad(p.day)}/${p.year}`;
}

/** Fecha larga legible, p. ej. "20 de julio de 1969" / "July 20, 1969". */
export function formatLongDate(iso: string, lang: Lang): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  return new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(p.year, p.month - 1, p.day)));
}
