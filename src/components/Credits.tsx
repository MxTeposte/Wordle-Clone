import Link from 'next/link';
import { getDictionary } from '@/i18n';
import { AUTHOR, BUILT_WITH } from '@/lib/author';
import type { Lang } from '@/lib/types';
import { Logo } from './Icons';

const SOURCES = [
  {
    name: 'SCOWL (Spell Checker Oriented Word Lists)',
    url: 'https://wordlist.aspell.net/',
    author: 'Kevin Atkinson',
    version: '2020.12.07',
    license: 'Copyright 2000-2019 Kevin Atkinson. Permission to use, copy, modify, distribute and sell these word lists is granted without fee, provided the copyright notice appears in all copies.',
  },
  {
    name: 'RLA-ES — Diccionario de español para Hunspell',
    url: 'https://github.com/sbosio/rla-es',
    author: 'Santiago Bosio y colaboradores',
    version: 'v2.9',
    license: 'GPL-3.0+ / LGPL-3.0+ / MPL-1.1+ (MPL-1.1)',
  },
  {
    name: 'wordfreq',
    url: 'https://github.com/rspeer/wordfreq',
    author: 'Robyn Speer',
    version: '3.1.1',
    license: 'Apache-2.0 (code), CC BY-SA 4.0 (data)',
  },
  {
    name: 'List of Dirty, Naughty, Obscene and Otherwise Bad Words',
    url: 'https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words',
    author: 'Shutterstock',
    version: '5faf2ba',
    license: 'CC BY 4.0',
  },
];

export function Credits({ lang }: { lang: Lang }) {
  const t = getDictionary(lang);
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/${lang}`} className="mb-8 inline-flex items-center gap-2 font-black">
        <Logo /> Wordkstate
      </Link>
      <h1 className="text-3xl font-black tracking-tight">{t.credits.title}</h1>
      <p className="mt-4 leading-relaxed">{t.credits.intro}</p>

      <section aria-labelledby="author-heading" className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 id="author-heading" className="text-lg font-extrabold">
          {t.credits.author}
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--muted)]">{t.credits.author}</dt>
          <dd className="font-semibold">{AUTHOR.name}</dd>
          <dt className="text-[var(--muted)]">{t.credits.email}</dt>
          <dd>
            <a href={`mailto:${AUTHOR.email}`} className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline">
              {AUTHOR.email}
            </a>
          </dd>
          <dt className="text-[var(--muted)]">{t.credits.github}</dt>
          <dd>
            <a
              href={AUTHOR.githubUrl}
              className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
              rel="noopener"
            >
              @{AUTHOR.github}
            </a>
          </dd>
          <dt className="text-[var(--muted)]">{t.credits.builtWith}</dt>
          <dd>
            <a
              href={BUILT_WITH.url}
              className="font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
              rel="noopener"
            >
              {BUILT_WITH.name}
            </a>
          </dd>
        </dl>
      </section>
      <p className="mt-4 leading-relaxed">{t.credits.sources}</p>
      <ul className="mt-4 space-y-4">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <a href={s.url} className="font-bold text-[var(--accent)] underline-offset-2 hover:underline" rel="noopener">
              {s.name}
            </a>
            <p className="text-sm text-[var(--muted)]">
              {s.author} · {s.version}
            </p>
            <p className="mt-1 text-sm">{s.license}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 leading-relaxed">{t.credits.listsLicense}</p>
      <p className="mt-8">
        <Link href={`/${lang}`} className="font-bold text-[var(--accent)] underline-offset-2 hover:underline">
          ← {t.credits.back}
        </Link>
      </p>
    </main>
  );
}
