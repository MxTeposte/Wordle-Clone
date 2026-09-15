import { describe, expect, it } from 'vitest';
import {
  addDays,
  checkDateGuess,
  dateHints,
  daysBetween,
  DISPLAY_ORDER,
  formatDate,
  isLeapYear,
  isoToDigits,
  parseISODate,
  partialDateProblem,
  randomDate,
  todayUTC,
} from '@/lib/dates';
import { gameFromSlug, gamePath, GAMES } from '@/lib/games';
import { isInAlphabet, normalizeKey, normalizeWord } from '@/lib/normalize';
import { hashString, mulberry32, seededRng, shuffle } from '@/lib/prng';

describe('normalize', () => {
  it('quita tildes y diéresis, conserva Ñ', () => {
    expect(normalizeWord('árbol')).toBe('ARBOL');
    expect(normalizeWord('pingüino')).toBe('PINGUINO');
    expect(normalizeWord('niño')).toBe('NIÑO');
    expect(normalizeWord('AÑORÉ')).toBe('AÑORE');
  });
  it('valida alfabetos', () => {
    expect(isInAlphabet('NIÑO', 'es')).toBe(true);
    expect(isInAlphabet('NIÑO', 'en')).toBe(false);
    expect(isInAlphabet('CRANE', 'en')).toBe(true);
  });
  it('normaliza teclas', () => {
    expect(normalizeKey('á', 'es')).toBe('A');
    expect(normalizeKey('ñ', 'es')).toBe('Ñ');
    expect(normalizeKey('ñ', 'en')).toBeNull();
    expect(normalizeKey('Enter', 'es')).toBeNull();
    expect(normalizeKey('1', 'es')).toBeNull();
  });
});

describe('prng', () => {
  it('es determinista', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashString('x')).toBe(hashString('x'));
  });
  it('shuffle conserva elementos y es reproducible', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const s1 = shuffle(items, seededRng('seed'));
    const s2 = shuffle(items, seededRng('seed'));
    expect(s1).toEqual(s2);
    expect([...s1].sort((x, y) => x - y)).toEqual(items);
    expect(s1).not.toEqual(items);
  });
});

describe('dates', () => {
  it('bisiestos (regla gregoriana)', () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
  });
  it('parsea y rechaza fechas inexistentes', () => {
    expect(parseISODate('2020-02-29')).toEqual({ year: 2020, month: 2, day: 29 });
    expect(parseISODate('2023-02-29')).toBeNull();
    expect(parseISODate('2020-02-31')).toBeNull();
    expect(parseISODate('2020-13-01')).toBeNull();
    expect(parseISODate('20200101')).toBeNull();
  });
  it('aritmética de días', () => {
    expect(daysBetween('2026-09-15', '2026-09-16')).toBe(1);
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-12-31', 1)).toBe('2024-01-01');
    expect(todayUTC(new Date(Date.UTC(2026, 8, 15, 23, 59)))).toBe('2026-09-15');
  });
  it('valida intentos del juego de fecha', () => {
    expect(checkDateGuess('1969-07-20', '2026-09-15')).toBeNull();
    expect(checkDateGuess('1899-12-31', '2026-09-15')).toBe('before_1900');
    expect(checkDateGuess('2026-09-16', '2026-09-15')).toBe('future_date');
    expect(checkDateGuess('2026-09-15', '2026-09-15')).toBeNull();
    expect(checkDateGuess('2023-02-29', '2026-09-15')).toBe('invalid_date');
    expect(checkDateGuess('2023-02', '2026-09-15')).toBe('incomplete');
  });
  it('detecta problemas mientras se escribe', () => {
    const c = (s: string) => s.split('').map((ch) => (ch === '_' ? '' : ch));
    expect(partialDateProblem(c('18______'), '2026-09-15')).toBe('before_1900');
    expect(partialDateProblem(c('21______'), '2026-09-15')).toBe('future_date');
    expect(partialDateProblem(c('2030____'), '2026-09-15')).toBe('future_date');
    expect(partialDateProblem(c('____13__'), '2026-09-15')).toBe('invalid_date');
    expect(partialDateProblem(c('____0231'), '2026-09-15')).toBe('invalid_date');
    expect(partialDateProblem(c('____0229'), '2026-09-15')).toBeNull();
    expect(partialDateProblem(c('20230229'), '2026-09-15')).toBe('invalid_date');
    expect(partialDateProblem(c('1969____'), '2026-09-15')).toBeNull();
  });
  it('flechas por campo', () => {
    expect(dateHints('1969-07-20', '1985-07-02')).toEqual({ day: 'down', month: 'equal', year: 'up' });
  });
  it('fecha aleatoria dentro del rango', () => {
    const rng = seededRng('dates');
    for (let i = 0; i < 2000; i++) {
      const d = randomDate(rng, '2026-09-15');
      expect(checkDateGuess(d, '2026-09-15')).toBeNull();
    }
    expect(randomDate(() => 0, '2026-09-15')).toBe('1900-01-01');
    expect(randomDate(() => 0.9999999, '2026-09-15')).toBe('2026-09-15');
  });
  it('formato por idioma y orden visual', () => {
    expect(formatDate('1969-07-20', 'es')).toBe('20/07/1969');
    expect(formatDate('1969-07-20', 'en')).toBe('07/20/1969');
    const digits = isoToDigits('1969-07-20');
    expect(DISPLAY_ORDER.es.map((i) => digits[i]).join('')).toBe('20071969');
    expect(DISPLAY_ORDER.en.map((i) => digits[i]).join('')).toBe('07201969');
  });
});

describe('games', () => {
  it('definiciones del plan', () => {
    expect(GAMES.w5).toMatchObject({ length: 5, maxAttempts: 6 });
    expect(GAMES.w6).toMatchObject({ length: 6, maxAttempts: 7 });
    expect(GAMES.date).toMatchObject({ length: 8, maxAttempts: 6 });
  });
  it('slugs traducidos', () => {
    expect(gameFromSlug('es', 'fecha')?.id).toBe('date');
    expect(gameFromSlug('en', 'date')?.id).toBe('date');
    expect(gameFromSlug('en', 'fecha')).toBeNull();
    expect(gamePath('es', 'w6', true)).toBe('/es/6/practica');
    expect(gamePath('en', 'date')).toBe('/en/date');
  });
});
