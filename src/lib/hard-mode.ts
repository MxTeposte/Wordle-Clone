import type { GuessRecord } from './types';

export type HardModeViolation = { kind: 'green'; position: number; letter: string } | { kind: 'yellow'; letter: string };

/**
 * Comprueba que un intento use todas las pistas reveladas:
 * verdes en su posición y amarillos en cualquier lugar (con repeticiones).
 */
export function hardModeViolation(guess: readonly string[], previous: readonly GuessRecord[]): HardModeViolation | null {
  for (const record of previous) {
    const letters = Array.from(record.value);
    for (let i = 0; i < letters.length; i++) {
      if (record.result[i] === 'correct' && guess[i] !== letters[i]) {
        return { kind: 'green', position: i + 1, letter: letters[i] };
      }
    }
    const required = new Map<string, number>();
    letters.forEach((l, i) => {
      if (record.result[i] !== 'absent') required.set(l, (required.get(l) ?? 0) + 1);
    });
    for (const [letter, count] of required) {
      if (guess.filter((g) => g === letter).length < count) return { kind: 'yellow', letter };
    }
  }
  return null;
}
