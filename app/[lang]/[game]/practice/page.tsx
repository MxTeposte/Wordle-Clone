import { GameScreen } from '@/components/GameScreen';
import { getStartDate } from '@/server/config';
import { gameMetadata, resolveGamePage } from '@/server/pages';

// Practice route in English (/en/5/practice). Spanish uses /es/5/practica.
export async function generateMetadata({ params }: PageProps<'/[lang]/[game]/practice'>) {
  const { lang, game } = await params;
  return gameMetadata(lang, game, true);
}

export default async function PracticePage({ params }: PageProps<'/[lang]/[game]/practice'>) {
  const p = await params;
  const { lang, game } = resolveGamePage(p.lang, p.game, 'en');
  return <GameScreen key={`${lang}-${game.id}-practice`} lang={lang} gameId={game.id} mode="practice" startDate={getStartDate()} />;
}
