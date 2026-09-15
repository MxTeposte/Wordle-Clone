import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isInAlphabet } from '@/lib/normalize';
import type { Lang, WordLength } from '@/lib/types';

const load = (lang: Lang, length: WordLength, kind: 'answers' | 'allowed'): string[] =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'src/words', lang, String(length), `${kind}.json`), 'utf8'));

const MIN_ALLOWED: Record<Lang, Record<WordLength, number>> = {
  en: { 5: 10_000, 6: 10_000 },
  // es/5: el vocabulario real de 5 letras del diccionario ronda 9 100 (ver data/SOURCES.md).
  es: { 5: 9_000, 6: 10_000 },
};

describe.each([
  ['en', 5],
  ['en', 6],
  ['es', 5],
  ['es', 6],
] as [Lang, WordLength][])('listas %s/%i', (lang, length) => {
  const answers = load(lang, length, 'answers');
  const allowed = load(lang, length, 'allowed');
  const allowedSet = new Set(allowed);

  it('tamaños dentro del rango esperado', () => {
    expect(answers.length).toBeGreaterThanOrEqual(1000);
    expect(answers.length).toBeLessThanOrEqual(2500);
    expect(allowed.length).toBeGreaterThanOrEqual(MIN_ALLOWED[lang][length]);
  });

  it('answers ⊆ allowed', () => {
    expect(answers.filter((w) => !allowedSet.has(w))).toEqual([]);
  });

  it('longitud exacta y alfabeto válido', () => {
    const bad = [...answers, ...allowed].filter((w) => [...w].length !== length || !isInAlphabet(w, lang));
    expect(bad).toEqual([]);
  });

  it('sin duplicados', () => {
    expect(new Set(answers).size).toBe(answers.length);
    expect(allowedSet.size).toBe(allowed.length);
  });

  it('respeta la blocklist', () => {
    const block = readFileSync(path.join(__dirname, `../../data/blocklist.${lang}.txt`), 'utf8')
      .split(/\r?\n/)
      .flatMap((l) => l.replace(/#.*$/, '').trim().split(/\s+/))
      .filter(Boolean)
      .map((w) => w.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC'));
    const answerSet = new Set(answers);
    expect(block.filter((w) => answerSet.has(w))).toEqual([]);
  });
});
