import { describe, expect, it } from 'vitest';
import { evaluate, isSolved, symbols } from '@/lib/evaluate';

const ev = (guess: string, solution: string) =>
  evaluate(symbols(guess), symbols(solution))
    .map((r) => (r === 'correct' ? 'G' : r === 'present' ? 'Y' : '-'))
    .join('');

describe('evaluate', () => {
  it('marca verdes, amarillos y grises', () => {
    expect(ev('CRANE', 'CRANE')).toBe('GGGGG');
    expect(ev('ABCDE', 'FGHIJ')).toBe('-----');
    expect(ev('EABCD', 'ABCDE')).toBe('YYYYY');
  });

  it('ABBEY / BABES: letras repetidas', () => {
    // Solución ABBEY, intento BABES
    expect(ev('BABES', 'ABBEY')).toBe('YYGG-');
  });

  it('LLAMA / ALLAN', () => {
    expect(ev('ALLAN', 'LLAMA')).toBe('YGYY-');
  });

  it('no marca más amarillos que apariciones en la solución', () => {
    expect(ev('EEEEE', 'CRANE')).toBe('----G');
    expect(ev('SPEED', 'ABIDE')).toBe('--Y-Y');
    expect(ev('LEVEL', 'HELLO')).toBe('YG--Y');
  });

  it('letras triples', () => {
    expect(ev('AAABB', 'BAAAA')).toBe('YGGY-');
    expect(ev('OOOXX', 'XOXOO')).toBe('YGYYY');
  });

  it('funciona con Ñ', () => {
    expect(ev('NIÑOS', 'SEÑOR')).toBe('--GGY');
    expect(ev('ÑANDU', 'NAÑOS')).toBe('YGY--');
  });

  it('palabras de 6 letras: BANANA / ANANAS', () => {
    // Solución ANANAS, intento BANANA
    expect(ev('BANANA', 'ANANAS')).toBe('-YYYYY');
  });

  it('dígitos del juego de fecha', () => {
    // Solución 2001-10-10, intento 2000-01-01
    expect(ev('20000101', '20011010')).toBe('GGGYYY-Y');
    // 29 de febrero
    expect(ev('20000229', '20000229')).toBe('GGGGGGGG');
  });

  it('rechaza longitudes distintas', () => {
    expect(() => evaluate(['A'], ['A', 'B'])).toThrow();
  });

  it('isSolved', () => {
    expect(isSolved(['correct', 'correct'])).toBe(true);
    expect(isSolved(['correct', 'present'])).toBe(false);
  });
});
