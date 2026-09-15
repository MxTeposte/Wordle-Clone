import type { Lang } from '@/lib/types';
import en from './en';
import es from './es';

type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends string
    ? string
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : { [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof es>;

const DICTIONARIES: Record<Lang, Dictionary> = { es, en };

export const getDictionary = (lang: Lang): Dictionary => DICTIONARIES[lang];

export const otherLang = (lang: Lang): Lang => (lang === 'es' ? 'en' : 'es');
