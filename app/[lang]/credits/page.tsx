import { notFound } from 'next/navigation';
import { Credits } from '@/components/Credits';
import { getDictionary } from '@/i18n';

export const metadata = { title: getDictionary('en').credits.title };

export default async function CreditsPage({ params }: PageProps<'/[lang]/credits'>) {
  const { lang } = await params;
  if (lang !== 'en') notFound();
  return <Credits lang="en" />;
}
