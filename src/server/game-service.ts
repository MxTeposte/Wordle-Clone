import 'server-only';
import {
  checkDateGuess,
  type DateGuessError,
  dateHints,
  daysBetween,
  digitsToISO,
  isoToDigits,
  isValidISODate,
  randomDate,
  todayUTC,
} from '@/lib/dates';
import { evaluate, isSolved, symbols } from '@/lib/evaluate';
import { GAMES, type GameDefinition, wordLengthOf } from '@/lib/games';
import { isInAlphabet, normalizeWord } from '@/lib/normalize';
import { seededRng } from '@/lib/prng';
import { type DateHints, type GameId, isGameId, isLang, type Lang, type TileResult } from '@/lib/types';
import { getServerConfig } from './config';
import { openToken, sealToken } from './token';
import { accentedForm, getWordLists } from './words';

export type ServiceError = { status: number; error: 'bad_request' | 'invalid_date' | 'invalid_token' };

export type ResolvedGame = {
  game: GameDefinition;
  lang: Lang;
  mode: 'daily' | 'practice';
  /** Palabra normalizada o fecha ISO. */
  solution: string;
  /** Límite superior de fechas válidas (juego de fecha). */
  maxDate: string;
  dateHints: boolean;
  /** Número de reto diario (1 = START_DATE). */
  puzzleNumber?: number;
};

export type GuessResponse =
  | { valid: true; result: TileResult[]; hints?: DateHints; solved: boolean }
  | { valid: false; reason: 'not_in_word_list' | 'wrong_length' | DateGuessError };

const bad = (error: ServiceError['error'] = 'bad_request', status = 400): ServiceError => ({ status, error });
export const isServiceError = (v: unknown): v is ServiceError => typeof v === 'object' && v !== null && 'error' in v;

const MAX_DATE_SKEW_DAYS = 1;

/** Acepta la fecha local del cliente solo si está a ±1 día de la fecha UTC del servidor. */
export function isAcceptableClientDate(date: string, startDate: string, now = new Date()): boolean {
  if (!isValidISODate(date)) return false;
  if (daysBetween(startDate, date) < 0) return false;
  return Math.abs(daysBetween(todayUTC(now), date)) <= MAX_DATE_SKEW_DAYS;
}

async function dailySolution(gameId: GameId, lang: Lang, date: string): Promise<{ solution: string; puzzleNumber: number }> {
  const { wordSeed, startDate } = getServerConfig();
  const dayIndex = daysBetween(startDate, date);
  if (gameId === 'date') {
    // Misma fecha para ambos idiomas; el rango termina el día del reto.
    return { solution: randomDate(seededRng(wordSeed, 'date', dayIndex), date), puzzleNumber: dayIndex + 1 };
  }
  const { answers } = await getWordLists(lang, wordLengthOf(gameId), wordSeed);
  return { solution: answers[dayIndex % answers.length], puzzleNumber: dayIndex + 1 };
}

/** Determina la partida (y su solución) a partir del cuerpo de una petición. */
export async function resolveGame(body: unknown, now = new Date()): Promise<ResolvedGame | ServiceError> {
  if (typeof body !== 'object' || body === null) return bad();
  const { game, lang, mode, date, token, hints } = body as Record<string, unknown>;
  if (!isGameId(game) || !isLang(lang)) return bad();
  const { startDate, wordSeed, gameSecret } = getServerConfig();

  if (mode === 'daily') {
    if (typeof date !== 'string' || !isAcceptableClientDate(date, startDate, now)) return bad('invalid_date');
    const { solution, puzzleNumber } = await dailySolution(game, lang, date);
    return {
      game: GAMES[game],
      lang,
      mode,
      solution,
      maxDate: date,
      dateHints: game === 'date' && hints === true,
      puzzleNumber,
    };
  }

  if (mode === 'practice') {
    if (typeof token !== 'string') return bad('invalid_token');
    const payload = await openToken(token, gameSecret);
    if (!payload || payload.game !== game) return bad('invalid_token');
    let solution: string;
    if (game === 'date') {
      solution = String(payload.ref);
    } else {
      const { answers } = await getWordLists(payload.lang, wordLengthOf(game), wordSeed);
      solution = answers[Number(payload.ref) % answers.length];
    }
    // El idioma de una partida de práctica de palabras queda fijado en el token.
    return {
      game: GAMES[game],
      lang: game === 'date' ? lang : payload.lang,
      mode,
      solution,
      maxDate: payload.createdOn,
      dateHints: payload.dateHints,
    };
  }
  return bad();
}

/** Valida y evalúa un intento. */
export async function checkGuess(resolved: ResolvedGame, rawGuess: unknown): Promise<GuessResponse | ServiceError> {
  if (typeof rawGuess !== 'string' || rawGuess.length > 32) return bad();
  const { game, lang, solution } = resolved;

  if (game.kind === 'date') {
    const iso = /^\d{8}$/.test(rawGuess) ? digitsToISO(rawGuess) : rawGuess;
    const problem = checkDateGuess(iso, resolved.maxDate);
    if (problem) return { valid: false, reason: problem };
    const result = evaluate(symbols(isoToDigits(iso)), symbols(isoToDigits(solution)));
    return {
      valid: true,
      result,
      ...(resolved.dateHints ? { hints: dateHints(iso, solution) } : {}),
      solved: isSolved(result),
    };
  }

  const guess = normalizeWord(rawGuess);
  if ([...guess].length !== game.length || !isInAlphabet(guess, lang)) return { valid: false, reason: 'wrong_length' };
  const { allowed } = await getWordLists(lang, wordLengthOf(game.id), getServerConfig().wordSeed);
  if (!allowed.has(guess)) return { valid: false, reason: 'not_in_word_list' };
  const result = evaluate(symbols(guess), symbols(solution));
  return { valid: true, result, solved: isSolved(result) };
}

/** Crea una partida de práctica y devuelve su token cifrado. */
export async function createPractice(body: unknown, now = new Date()): Promise<{ token: string; maxDate: string } | ServiceError> {
  if (typeof body !== 'object' || body === null) return bad();
  const { game, lang, hints } = body as Record<string, unknown>;
  if (!isGameId(game) || !isLang(lang)) return bad();
  const { wordSeed, gameSecret } = getServerConfig();
  const createdOn = todayUTC(now);
  const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

  let ref: number | string;
  if (game === 'date') {
    ref = randomDate(random, createdOn);
  } else {
    const { answers } = await getWordLists(lang, wordLengthOf(game), wordSeed);
    ref = Math.floor(random() * answers.length);
  }
  const token = await sealToken(
    { v: 1, game, lang, ref, createdOn, dateHints: game === 'date' && hints === true },
    gameSecret,
  );
  return { token, maxDate: createdOn };
}

export type RevealResponse = { solution: string; display: string; puzzleNumber?: number };

/**
 * Revela la solución solo si la partida terminó: todos los intentos usados
 * (y válidos) o la solución ya fue encontrada.
 */
export async function reveal(resolved: ResolvedGame, guesses: unknown): Promise<RevealResponse | ServiceError> {
  if (!Array.isArray(guesses) || guesses.length > resolved.game.maxAttempts) return bad();
  let finished = false;
  let validCount = 0;
  for (const g of guesses) {
    const res = await checkGuess(resolved, g);
    if (isServiceError(res) || !res.valid) return bad();
    validCount++;
    if (res.solved) finished = true;
  }
  if (!finished && validCount < resolved.game.maxAttempts) return bad();

  const { solution, lang, game } = resolved;
  return {
    solution,
    display: game.kind === 'date' ? solution : await accentedForm(solution, lang),
    puzzleNumber: resolved.puzzleNumber,
  };
}
