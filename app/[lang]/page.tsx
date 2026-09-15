import { notFound } from 'next/navigation';
import { GameMenu } from '@/components/GameMenu';
import { isLang } from '@/lib/types';
import { getStartDate } from '@/server/config';

export default async function HomePage({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <GameMenu lang={lang} startDate={getStartDate()} />;
}
