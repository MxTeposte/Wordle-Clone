import 'server-only';
import { seededRng, shuffle } from '@/lib/prng';
import type { Lang, WordLength } from '@/lib/types';

type JsonList = { default: string[] };

// Importaciones estáticas por idioma y longitud para que el bundler incluya cada lista.
const LOADERS: Record<Lang, Record<WordLength, { answers: () => Promise<JsonList>; allowed: () => Promise<JsonList> }>> = {
  en: {
    5: { answers: () => import('@/words/en/5/answers.json'), allowed: () => import('@/words/en/5/allowed.json') },
    6: { answers: () => import('@/words/en/6/answers.json'), allowed: () => import('@/words/en/6/allowed.json') },
  },
  es: {
    5: { answers: () => import('@/words/es/5/answers.json'), allowed: () => import('@/words/es/5/allowed.json') },
    6: { answers: () => import('@/words/es/6/answers.json'), allowed: () => import('@/words/es/6/allowed.json') },
  },
};

export type WordLists = {
  /** Soluciones reordenadas con la semilla secreta (WORD_SEED). */
  answers: string[];
  allowed: Set<string>;
};

const cache = new Map<string, Promise<WordLists>>();

export function getWordLists(lang: Lang, length: WordLength, wordSeed: string): Promise<WordLists> {
  const key = `${lang}:${length}:${wordSeed}`;
  let lists = cache.get(key);
  if (!lists) {
    const loader = LOADERS[lang][length];
    lists = Promise.all([loader.answers(), loader.allowed()]).then(([answers, allowed]) => ({
      answers: shuffle(answers.default, seededRng(wordSeed, 'answers', lang, length)),
      allowed: new Set(allowed.default),
    }));
    cache.set(key, lists);
  }
  return lists;
}

let accents: Promise<Record<string, string>> | null = null;

/** Forma con tildes de una solución en español (p. ej. ARBOL → ÁRBOL). */
export async function accentedForm(word: string, lang: Lang): Promise<string> {
  if (lang !== 'es') return word;
  accents ??= import('@/words/es/accents.json').then((m) => m.default as Record<string, string>);
  return ((await accents)[word] ?? word.toLowerCase()).toUpperCase();
}
