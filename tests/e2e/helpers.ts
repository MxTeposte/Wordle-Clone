import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { daysBetween, DISPLAY_ORDER, isoToDigits, randomDate, todayUTC } from '../../src/lib/dates';
import { seededRng, shuffle } from '../../src/lib/prng';
import type { Lang, WordLength } from '../../src/lib/types';
import { E2E_ENV } from '../../playwright.config';

export const words = (lang: Lang, length: WordLength, kind: 'answers' | 'allowed'): string[] =>
  JSON.parse(readFileSync(path.join(process.cwd(), 'src/words', lang, String(length), `${kind}.json`), 'utf8'));

const dayIndex = () => daysBetween(E2E_ENV.START_DATE, todayUTC());

/** Reproduce la selección del servidor con la semilla de pruebas. */
export function dailyWord(lang: Lang, length: WordLength): string {
  const answers = shuffle(words(lang, length, 'answers'), seededRng(E2E_ENV.WORD_SEED, 'answers', lang, length));
  return answers[dayIndex() % answers.length];
}

export function dailyDate(): string {
  return randomDate(seededRng(E2E_ENV.WORD_SEED, 'date', dayIndex()), todayUTC());
}

/** Palabras válidas distintas de la solución (para perder a propósito). */
export function wrongWords(lang: Lang, length: WordLength, count: number): string[] {
  const solution = dailyWord(lang, length);
  return words(lang, length, 'allowed')
    .filter((w) => w !== solution && ![...w].some((c) => solution.includes(c)))
    .slice(0, count);
}

/** Dígitos a teclear para una fecha ISO según el orden visual del idioma. */
export const dateKeys = (iso: string, lang: Lang) => DISPLAY_ORDER[lang].map((i) => isoToDigits(iso)[i]).join('');

export async function openGame(page: Page, url: string) {
  // Evita el diálogo de reglas de la primera visita.
  await page.addInitScript(() => window.localStorage.setItem('wordkstate:seen-help', 'true'));
  await page.goto(url);
  await expect(page.getByRole('group', { name: /^(Intento|Guess) 1$/ })).toBeVisible();
}

export async function guess(page: Page, text: string) {
  await page.keyboard.type(text, { delay: 15 });
  await page.keyboard.press('Enter');
}

export const toast = (page: Page) => page.getByRole('status');
