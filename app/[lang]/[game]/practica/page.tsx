import { GameScreen } from '@/components/GameScreen';
import { getStartDate } from '@/server/config';
import { gameMetadata, resolveGamePage } from '@/server/pages';

// Ruta de práctica en español (/es/5/practica). En inglés se usa /en/5/practice.
export async function generateMetadata({ params }: PageProps<'/[lang]/[game]/practica'>) {
  const { lang, game } = await params;
  return gameMetadata(lang, game, true);
}

export default async function PracticaPage({ params }: PageProps<'/[lang]/[game]/practica'>) {
  const p = await params;
  const { lang, game } = resolveGamePage(p.lang, p.game, 'es');
  return <GameScreen key={`${lang}-${game.id}-practice`} lang={lang} gameId={game.id} mode="practice" startDate={getStartDate()} />;
}
