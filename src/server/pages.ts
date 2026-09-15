import 'server-only';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n';
import { GAME_LIST, gameFromSlug } from '@/lib/games';
import { isLang, type Lang } from '@/lib/types';

/** Slugs de juego para un idioma (el layout [lang] genera los idiomas). */
export const gameStaticParams = ({ params }: { params: { lang: string } }) =>
  isLang(params.lang) ? GAME_LIST.map((g) => ({ game: g.slug[params.lang as Lang] })) : [];

/** Valida idioma, slug de juego y (opcional) el idioma propio de la ruta, o responde 404. */
export function resolveGamePage(lang: string, slug: string, onlyLang?: Lang) {
  if (!isLang(lang) || (onlyLang && lang !== onlyLang)) notFound();
  const game = gameFromSlug(lang, slug);
  if (!game) notFound();
  return { lang, game };
}

export function gameMetadata(lang: string, slug: string, practice: boolean): Metadata {
  if (!isLang(lang)) return {};
  const game = gameFromSlug(lang, slug);
  if (!game) return {};
  const t = getDictionary(lang);
  const name = t.games[game.id].name;
  return {
    title: practice ? `${name} · ${t.game.practiceBadge}` : name,
    description: t.games[game.id].description(game.maxAttempts),
  };
}
