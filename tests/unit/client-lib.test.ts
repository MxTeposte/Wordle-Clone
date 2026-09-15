import { describe, expect, it } from 'vitest';
import { hardModeViolation } from '@/lib/hard-mode';
import { buildShareText } from '@/lib/share';
import { emptyStats, recordPracticeResult, recordResult, visibleStreak, winPercentage } from '@/lib/stats';
import { keys } from '@/lib/storage';
import type { GuessRecord } from '@/lib/types';

describe('stats', () => {
  it('registra victorias, derrotas y rachas por días consecutivos', () => {
    let s = emptyStats(6);
    s = recordResult(s, '2026-09-15', true, 3, 6);
    s = recordResult(s, '2026-09-16', true, 4, 6);
    expect(s).toMatchObject({ played: 2, wins: 2, currentStreak: 2, maxStreak: 2 });
    expect(s.distribution).toEqual([0, 0, 1, 1, 0, 0]);

    // Saltarse un día reinicia la racha.
    s = recordResult(s, '2026-09-18', true, 2, 6);
    expect(s).toMatchObject({ currentStreak: 1, maxStreak: 2 });

    s = recordResult(s, '2026-09-19', false, 6, 6);
    expect(s).toMatchObject({ played: 4, wins: 3, currentStreak: 0, maxStreak: 2 });
    expect(winPercentage(s)).toBe(75);
  });

  it('es idempotente por fecha', () => {
    const once = recordResult(emptyStats(6), '2026-09-15', true, 1, 6);
    expect(recordResult(once, '2026-09-15', true, 1, 6)).toBe(once);
  });

  it('práctica: sin fechas, la racha son victorias seguidas', () => {
    let s = emptyStats(7);
    s = recordPracticeResult(s, true, 4, 7);
    s = recordPracticeResult(s, true, 7, 7);
    expect(s).toMatchObject({ played: 2, wins: 2, currentStreak: 2, maxStreak: 2 });
    expect(s.distribution).toEqual([0, 0, 0, 1, 0, 0, 1]);
    s = recordPracticeResult(s, false, 7, 7);
    expect(s).toMatchObject({ played: 3, wins: 2, currentStreak: 0, maxStreak: 2 });
  });

  it('las claves de práctica no pisan las del reto diario', () => {
    expect(keys.stats('w5', 'en', false)).toBe('wordkstate:stats:w5:en');
    expect(keys.stats('w5', 'en', false, 'practice')).toBe('wordkstate:stats:practice:w5:en');
    expect(keys.stats('date', 'es', true, 'practice')).toBe('wordkstate:stats:practice:date:hints');
  });

  it('la racha visible caduca si pasa más de un día', () => {
    const s = recordResult(emptyStats(6), '2026-09-15', true, 1, 6);
    expect(visibleStreak(s, '2026-09-16')).toBe(1);
    expect(visibleStreak(s, '2026-09-17')).toBe(0);
  });
});

describe('modo difícil', () => {
  const prev: GuessRecord[] = [{ value: 'CRANE', result: ['correct', 'absent', 'present', 'absent', 'absent'] }];
  it('exige verdes en su posición', () => {
    expect(hardModeViolation([...'BATHS'], prev)).toEqual({ kind: 'green', position: 1, letter: 'C' });
  });
  it('exige incluir los amarillos', () => {
    expect(hardModeViolation([...'CLOTH'], prev)).toEqual({ kind: 'yellow', letter: 'A' });
  });
  it('acepta intentos que usan las pistas', () => {
    expect(hardModeViolation([...'CHAMP'], prev)).toBeNull();
  });
});

describe('compartir', () => {
  const guesses: GuessRecord[] = [
    { value: 'CRANE', result: ['absent', 'present', 'absent', 'absent', 'correct'] },
    { value: 'SHORE', result: ['correct', 'correct', 'correct', 'correct', 'correct'] },
  ];

  it('palabras: cabecera, puntuación y emojis', () => {
    const text = buildShareText({
      game: 'w5',
      lang: 'es',
      gameLabel: '5',
      practiceLabel: 'práctica',
      puzzleNumber: 12,
      guesses,
      won: true,
      hardMode: true,
      dateHints: false,
      highContrast: false,
    });
    expect(text).toBe('Wordkstate 5 #12 2/6*\n\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩');
  });

  it('fecha: orden visual por idioma, flechas y derrota', () => {
    // Canónico YYYYMMDD: el año va verde y el día amarillo.
    const g: GuessRecord = {
      value: '1969-07-20',
      result: ['correct', 'correct', 'correct', 'correct', 'absent', 'absent', 'present', 'present'],
    };
    const base = {
      game: 'date' as const,
      gameLabel: 'Fecha',
      practiceLabel: 'práctica',
      guesses: [g],
      won: false,
      hardMode: false,
      dateHints: true,
      highContrast: true,
    };
    expect(buildShareText({ ...base, lang: 'es' })).toBe('Wordkstate Fecha (práctica) X/10 ↕\n\n🟦🟦 ⬛⬛ 🟧🟧🟧🟧');
    expect(buildShareText({ ...base, lang: 'en', gameLabel: 'Date', practiceLabel: 'practice' })).toBe(
      'Wordkstate Date (practice) X/10 ↕\n\n⬛⬛ 🟦🟦 🟧🟧🟧🟧',
    );
  });
});
