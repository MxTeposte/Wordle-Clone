import { GameScreen } from '@/components/GameScreen';
import { getStartDate } from '@/server/config';
import { gameMetadata, gameStaticParams, resolveGamePage } from '@/server/pages';

export const dynamicParams = false;

export const generateStaticParams = gameStaticParams;

export async function generateMetadata({ params }: PageProps<'/[lang]/[game]'>) {
  const { lang, game } = await params;
  return gameMetadata(lang, game, false);
}

export default async function DailyGamePage({ params }: PageProps<'/[lang]/[game]'>) {
  const p = await params;
  const { lang, game } = resolveGamePage(p.lang, p.game);
  return <GameScreen key={`${lang}-${game.id}-daily`} lang={lang} gameId={game.id} mode="daily" startDate={getStartDate()} />;
}
