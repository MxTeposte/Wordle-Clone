import type { TileResult } from './types';

/**
 * Evalúa un intento contra la solución con las reglas de Wordle.
 * Sirve para letras y dígitos: recibe secuencias de símbolos de igual longitud.
 *
 * 1. Verde donde el símbolo coincide en posición; se descuenta de los restantes.
 * 2. Amarillo si el símbolo aún queda en la solución; si no, gris.
 */
export function evaluate(guess: readonly string[], solution: readonly string[]): TileResult[] {
  if (guess.length !== solution.length) {
    throw new Error(`Longitudes distintas: ${guess.length} vs ${solution.length}`);
  }
  const result: TileResult[] = new Array(guess.length).fill('absent');
  const remaining = new Map<string, number>();

  for (let i = 0; i < solution.length; i++) {
    if (guess[i] === solution[i]) result[i] = 'correct';
    else remaining.set(solution[i], (remaining.get(solution[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] === 'correct') continue;
    const left = remaining.get(guess[i]) ?? 0;
    if (left > 0) {
      result[i] = 'present';
      remaining.set(guess[i], left - 1);
    }
  }
  return result;
}

/** Divide una palabra en símbolos (seguro para Ñ y cualquier carácter Unicode). */
export const symbols = (value: string): string[] => Array.from(value);

export const isSolved = (result: readonly TileResult[]) => result.every((r) => r === 'correct');
