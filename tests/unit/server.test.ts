import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isoToDigits, todayUTC } from '@/lib/dates';
import {
  checkGuess,
  createPractice,
  isAcceptableClientDate,
  isServiceError,
  resolveGame,
  type ResolvedGame,
  reveal,
} from '@/server/game-service';
import { openToken, sealToken } from '@/server/token';
import { accentedForm, getWordLists } from '@/server/words';

const NOW = new Date(Date.UTC(2026, 9, 1, 12)); // 2026-10-01
const TODAY = todayUTC(NOW);

beforeEach(() => {
  vi.stubEnv('WORD_SEED', 'test-seed');
  vi.stubEnv('GAME_SECRET', 'test-secret');
  vi.stubEnv('START_DATE', '2026-09-15');
});
afterEach(() => vi.unstubAllEnvs());

async function resolved(body: object): Promise<ResolvedGame> {
  const r = await resolveGame(body, NOW);
  if (isServiceError(r)) throw new Error(r.error);
  return r;
}

describe('token', () => {
  it('cifra y descifra; rechaza secretos distintos y alteraciones', async () => {
    const payload = { v: 1, game: 'w5', lang: 'es', ref: 10, createdOn: TODAY, dateHints: false } as const;
    const token = await sealToken(payload, 's1');
    expect(token).not.toContain('10');
    expect(await openToken(token, 's1')).toEqual(payload);
    expect(await openToken(token, 's2')).toBeNull();
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'BB' : 'AA');
    expect(await openToken(tampered, 's1')).toBeNull();
    expect(await openToken('basura', 's1')).toBeNull();
  });
});

describe('fecha del cliente', () => {
  it('acepta ±1 día respecto a UTC y no antes del reto #1', () => {
    expect(isAcceptableClientDate('2026-10-01', '2026-09-15', NOW)).toBe(true);
    expect(isAcceptableClientDate('2026-09-30', '2026-09-15', NOW)).toBe(true);
    expect(isAcceptableClientDate('2026-10-02', '2026-09-15', NOW)).toBe(true);
    expect(isAcceptableClientDate('2026-10-03', '2026-09-15', NOW)).toBe(false);
    expect(isAcceptableClientDate('2026-09-14', '2026-09-15', new Date(Date.UTC(2026, 8, 14)))).toBe(false);
  });
});

describe('reto diario de palabras', () => {
  it('misma solución para la misma fecha y distinta entre días', async () => {
    const a = await resolved({ game: 'w5', lang: 'es', mode: 'daily', date: TODAY });
    const b = await resolved({ game: 'w5', lang: 'es', mode: 'daily', date: TODAY });
    const c = await resolved({ game: 'w5', lang: 'es', mode: 'daily', date: '2026-09-30' });
    expect(a.solution).toBe(b.solution);
    expect(a.solution).not.toBe(c.solution);
    expect(a.puzzleNumber).toBe(17);
    expect([...a.solution]).toHaveLength(5);
  });

  it('la semilla secreta cambia la solución', async () => {
    const a = await resolved({ game: 'w6', lang: 'en', mode: 'daily', date: TODAY });
    vi.stubEnv('WORD_SEED', 'otra-semilla');
    const b = await resolved({ game: 'w6', lang: 'en', mode: 'daily', date: TODAY });
    expect(a.solution).not.toBe(b.solution);
  });

  it('rechaza fechas fuera de tolerancia', async () => {
    const r = await resolveGame({ game: 'w5', lang: 'es', mode: 'daily', date: '2027-01-01' }, NOW);
    expect(isServiceError(r) && r.error).toBe('invalid_date');
  });

  it('evalúa intentos y valida el diccionario', async () => {
    const game = await resolved({ game: 'w5', lang: 'es', mode: 'daily', date: TODAY });
    const win = await checkGuess(game, game.solution.toLowerCase());
    expect(win).toMatchObject({ valid: true, solved: true });
    expect(await checkGuess(game, 'ZZZZZ')).toEqual({ valid: false, reason: 'not_in_word_list' });
    expect(await checkGuess(game, 'ÁRBOL')).toMatchObject({ valid: true });
    expect(await checkGuess(game, 'casas')).toMatchObject({ valid: true }); // plural válido como intento
    expect(await checkGuess(game, 'ABC')).toEqual({ valid: false, reason: 'wrong_length' });
  });

  it('revela solo partidas terminadas', async () => {
    const game = await resolved({ game: 'w5', lang: 'en', mode: 'daily', date: TODAY });
    const { allowed } = await getWordLists('en', 5, 'test-seed');
    const wrong = [...allowed].filter((w) => w !== game.solution).slice(0, 6);
    expect(isServiceError(await reveal(game, wrong.slice(0, 3)))).toBe(true);
    expect(await reveal(game, wrong)).toMatchObject({ solution: game.solution });
    expect(await reveal(game, [wrong[0], game.solution])).toMatchObject({ solution: game.solution });
  });

  it('muestra la forma con tildes en español', async () => {
    expect(await accentedForm('ARBOL', 'es')).toBe('ÁRBOL');
    expect(await accentedForm('PERRO', 'es')).toBe('PERRO');
    expect(await accentedForm('CRANE', 'en')).toBe('CRANE');
  });
});

describe('juego de fecha', () => {
  it('la solución es igual en ambos idiomas y está en rango', async () => {
    const es = await resolved({ game: 'date', lang: 'es', mode: 'daily', date: TODAY });
    const en = await resolved({ game: 'date', lang: 'en', mode: 'daily', date: TODAY });
    expect(es.solution).toBe(en.solution);
    expect(es.solution >= '1900-01-01' && es.solution <= TODAY).toBe(true);
  });

  it('flechas solo si se piden', async () => {
    const off = await resolved({ game: 'date', lang: 'es', mode: 'daily', date: TODAY });
    const on = await resolved({ game: 'date', lang: 'es', mode: 'daily', date: TODAY, hints: true });
    const g1 = await checkGuess(off, '1969-07-20');
    const g2 = await checkGuess(on, '19690720');
    expect(g1).not.toHaveProperty('hints');
    expect(g2).toHaveProperty('hints');
  });

  it('rechaza fechas futuras, inexistentes y anteriores a 1900', async () => {
    const game = await resolved({ game: 'date', lang: 'en', mode: 'daily', date: TODAY });
    expect(await checkGuess(game, '2026-10-02')).toEqual({ valid: false, reason: 'future_date' });
    expect(await checkGuess(game, '2023-02-29')).toEqual({ valid: false, reason: 'invalid_date' });
    expect(await checkGuess(game, '1899-12-31')).toEqual({ valid: false, reason: 'before_1900' });
    expect(await checkGuess(game, isoToDigits(game.solution))).toMatchObject({ valid: true, solved: true });
  });
});

describe('práctica', () => {
  it('crea partidas resolubles sin exponer la solución', async () => {
    for (const game of ['w5', 'w6', 'date'] as const) {
      const created = await createPractice({ game, lang: 'es', hints: true }, NOW);
      if (isServiceError(created)) throw new Error(created.error);
      const r = await resolved({ game, lang: 'es', mode: 'practice', token: created.token });
      expect(created.token).not.toContain(r.solution);
      expect(r.dateHints).toBe(game === 'date');
      expect(await checkGuess(r, r.solution)).toMatchObject({ valid: true, solved: true });
    }
  });

  it('rechaza tokens de otro juego o inválidos', async () => {
    const created = await createPractice({ game: 'w5', lang: 'en' }, NOW);
    if (isServiceError(created)) throw new Error(created.error);
    const r = await resolveGame({ game: 'w6', lang: 'en', mode: 'practice', token: created.token }, NOW);
    expect(isServiceError(r) && r.error).toBe('invalid_token');
    const r2 = await resolveGame({ game: 'w5', lang: 'en', mode: 'practice', token: 'x'.repeat(40) }, NOW);
    expect(isServiceError(r2) && r2.error).toBe('invalid_token');
  });
});
