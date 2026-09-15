import { notFound } from 'next/navigation';
import { Credits } from '@/components/Credits';
import { getDictionary } from '@/i18n';

export const metadata = { title: getDictionary('es').credits.title };

export default async function CreditosPage({ params }: PageProps<'/[lang]/creditos'>) {
  const { lang } = await params;
  if (lang !== 'es') notFound();
  return <Credits lang="es" />;
}
