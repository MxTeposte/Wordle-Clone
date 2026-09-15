/**
 * Genera las listas de palabras de Wordkstate a partir de data/raw/.
 *
 *   pnpm words:fetch   # una vez
 *   pnpm words:build
 *
 * Salida (versionada):
 *   src/words/{en,es}/{5,6}/answers.json   soluciones (barajadas con semilla fija)
 *   src/words/{en,es}/{5,6}/allowed.json   intentos válidos (ordenados)
 *   src/words/es/accents.json              forma normalizada → forma con tildes
 *   data/REPORT.md                         estadísticas y muestras
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isInAlphabet, normalizeWord } from '../src/lib/normalize';
import { seededRng, shuffle } from '../src/lib/prng';
import type { Lang, WordLength } from '../src/lib/types';
import { parseHunspell } from './lib/hunspell';
import { loadZipf } from './lib/wordfreq';

const ROOT = process.cwd();
const RAW = path.join(ROOT, 'data', 'raw');
const OUT = path.join(ROOT, 'src', 'words');
const LENGTHS: WordLength[] = [5, 6];

/** Semilla del barajado de soluciones. Cambiarla reordena todos los retos diarios. */
const SHUFFLE_SEED = 'wordkstate-v1';

type ListConfig = {
  /** Frecuencia mínima (escala Zipf de wordfreq) para ser solución. */
  minZipf: number;
  /** Máximo de soluciones (se toman las más frecuentes). */
  maxAnswers: number;
};

const CONFIG: Record<Lang, Record<WordLength, ListConfig> & { allowedMaxLevel?: number; answerMaxLevel?: number }> = {
  en: {
    5: { minZipf: 3.0, maxAnswers: 2500 },
    6: { minZipf: 3.0, maxAnswers: 2500 },
    allowedMaxLevel: 80,
    answerMaxLevel: 50,
  },
  es: {
    5: { minZipf: 3.0, maxAnswers: 2500 },
    6: { minZipf: 3.0, maxAnswers: 2500 },
  },
};

type Built = {
  allowed: Set<string>;
  /** Candidatas a solución: normalizada → { zipf, forma original }. */
  candidates: Map<string, { zipf: number; form: string; note?: string }>;
  stats: Record<string, number>;
};

const readLines = (file: string, encoding: BufferEncoding = 'utf8') =>
  existsSync(file)
    ? readFileSync(file, encoding)
        .split(/\r?\n/)
        .flatMap((l) => l.replace(/#.*$/, '').trim().split(/\s+/))
        .filter(Boolean)
    : [];

function requireRaw() {
  if (!existsSync(RAW)) {
    console.error('Falta data/raw/. Ejecuta primero: pnpm words:fetch');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Inglés: SCOWL + wordfreq
// ---------------------------------------------------------------------------

/** Heurística de inflexiones regulares en inglés (plurales, pasados, gerundios, superlativos -est). */
function isEnglishInflection(w: string, dict: Set<string>): boolean {
  const has = (s: string) => s.length >= 2 && dict.has(s);
  const doubled = (stem: string) => stem.length >= 3 && stem.at(-1) === stem.at(-2) && has(stem.slice(0, -1));

  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    if (has(w.slice(0, -1))) return true;
    if (w.endsWith('es') && has(w.slice(0, -2))) return true;
    if (w.endsWith('ies') && has(`${w.slice(0, -3)}y`)) return true;
  }
  if (w.endsWith('ed')) {
    const stem = w.slice(0, -2);
    if (has(stem) || has(`${stem}e`) || doubled(stem)) return true;
    if (w.endsWith('ied') && has(`${w.slice(0, -3)}y`)) return true;
  }
  if (w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    if (has(stem) || has(`${stem}e`) || doubled(stem)) return true;
  }
  if (w.endsWith('est')) {
    const stem = w.slice(0, -3);
    if (stem.length >= 3 && (has(stem) || has(`${stem}e`) || doubled(stem))) return true;
    if (w.endsWith('iest') && has(`${w.slice(0, -4)}y`)) return true;
  }
  return false;
}

function buildEnglish(length: WordLength): Built {
  const cfg = CONFIG.en;
  const dir = path.join(RAW, 'scowl');
  const level = new Map<string, number>();
  const dec = new TextDecoder('latin1');
  for (const f of readdirSync(dir)) {
    const m = f.match(/^(english|american)-words\.(\d+)$/);
    if (!m) continue;
    const lv = Number(m[2]);
    for (const w of dec.decode(readFileSync(path.join(dir, f))).split(/\r?\n/)) {
      if (!/^[a-z]+$/.test(w)) continue;
      const prev = level.get(w);
      if (prev === undefined || lv < prev) level.set(w, lv);
    }
  }
  const zipf = loadZipf(path.join(RAW, 'wordfreq', 'large_en.msgpack.gz'));
  const dict = new Set([...level].filter(([, lv]) => lv <= cfg.allowedMaxLevel!).map(([w]) => w));

  const allowed = new Set<string>();
  const candidates: Built['candidates'] = new Map();
  const stats = { dictionary: 0, inflections: 0, lowFrequency: 0, rareLevel: 0 };

  for (const w of dict) {
    if (w.length !== length) continue;
    const n = normalizeWord(w);
    allowed.add(n);
    stats.dictionary++;
    if (level.get(w)! > cfg.answerMaxLevel!) {
      stats.rareLevel++;
      continue;
    }
    if (isEnglishInflection(w, dict)) {
      stats.inflections++;
      continue;
    }
    const z = zipf.get(w) ?? 0;
    if (z < cfg[length].minZipf) {
      stats.lowFrequency++;
      continue;
    }
    candidates.set(n, { zipf: z, form: w });
  }
  return { allowed, candidates, stats };
}

// ---------------------------------------------------------------------------
// Español: Hunspell RLA-ES + wordfreq
// ---------------------------------------------------------------------------

let spanishCache: {
  forms: Map<string, Set<string>>;
  roots: Map<string, { flagless: boolean }>;
  zipf: Map<string, number>;
} | null = null;

function loadSpanish() {
  if (spanishCache) return spanishCache;
  const hs = parseHunspell(
    readFileSync(path.join(RAW, 'rla-es', 'es.aff'), 'utf8'),
    readFileSync(path.join(RAW, 'rla-es', 'es.dic'), 'utf8'),
  );
  const forms = new Map<string, Set<string>>(); // normalizada → formas originales
  const roots = new Map<string, { flagless: boolean }>();
  const lower = /^[a-záéíóúüñ]+$/;

  for (const entry of hs.entries) {
    // Nombres propios, siglas y entradas con símbolos quedan fuera.
    if (!lower.test(entry.word)) continue;
    const prev = roots.get(entry.word);
    roots.set(entry.word, { flagless: (prev?.flagless ?? true) && entry.flags.length === 0 });
    for (const form of hs.expand(entry)) {
      if (!lower.test(form)) continue;
      const n = normalizeWord(form);
      if (n.length < 5 || n.length > 6) continue;
      if (!forms.has(n)) forms.set(n, new Set());
      forms.get(n)!.add(form);
    }
  }
  const zipf = loadZipf(path.join(RAW, 'wordfreq', 'large_es.msgpack.gz'));
  spanishCache = { forms, roots, zipf };
  return spanishCache;
}

function buildSpanish(length: WordLength): Built {
  const { forms, roots, zipf } = loadSpanish();
  const allowed = new Set<string>();
  const candidates: Built['candidates'] = new Map();
  const stats = { dictionary: 0, notRoot: 0, lowFrequency: 0 };

  for (const [n, originals] of forms) {
    if (n.length !== length || !isInAlphabet(n, 'es')) continue;
    allowed.add(n);
    stats.dictionary++;

    // Solo las raíces del diccionario (singulares, infinitivos, invariables) pueden ser solución.
    const rootForms = [...originals].filter((f) => roots.has(f));
    if (!rootForms.length) {
      stats.notRoot++;
      continue;
    }
    // Entre variantes con y sin tilde (papa / papá), gana la más frecuente.
    const best = rootForms
      .map((f) => ({ form: f, zipf: zipf.get(f) ?? 0 }))
      .sort((a, b) => b.zipf - a.zipf)[0];
    // La frecuencia suma todas las formas que se escriben igual al jugar.
    const total = Math.log10(
      [...originals].reduce((acc, f) => acc + (zipf.has(f) ? 10 ** zipf.get(f)! : 0), 0) || 1e-9,
    );
    if (best.zipf < CONFIG.es[length].minZipf) {
      stats.lowFrequency++;
      continue;
    }
    candidates.set(n, {
      zipf: Math.max(best.zipf, Math.round(total * 100) / 100),
      form: best.form,
      note: rootForms.every((f) => roots.get(f)!.flagless) ? 'flagless' : undefined,
    });
  }
  return { allowed, candidates, stats };
}

// ---------------------------------------------------------------------------

function main() {
  requireRaw();
  const report: string[] = [
    '# Reporte de listas de palabras',
    '',
    'Generado por `pnpm words:build`. No editar a mano.',
    '',
    `Semilla de barajado: \`${SHUFFLE_SEED}\``,
    '',
    '| Idioma | Longitud | Intentos válidos (`allowed`) | Soluciones (`answers`) |',
    '|---|---|---|---|',
  ];
  const details: string[] = [];
  const accents: Record<string, string> = {};

  for (const lang of ['en', 'es'] as Lang[]) {
    const blocklist = new Set(readLines(path.join(ROOT, 'data', `blocklist.${lang}.txt`)).map(normalizeWord));
    const allowlist = readLines(path.join(ROOT, 'data', `allowlist.${lang}.txt`));
    const allowGuess = readLines(path.join(ROOT, 'data', `allowed-extra.${lang}.txt`)).map(normalizeWord);
    const offensive = new Set(readLines(path.join(RAW, `ldnoobw-${lang}.txt`)).map(normalizeWord));

    for (const length of LENGTHS) {
      const built = lang === 'en' ? buildEnglish(length) : buildSpanish(length);
      const { allowed, candidates } = built;
      const removed = { blocklist: 0, offensive: 0 };

      for (const w of allowGuess) if (w.length === length && isInAlphabet(w, lang)) allowed.add(w);

      const ranked = [...candidates]
        .filter(([n]) => {
          if (blocklist.has(n)) return removed.blocklist++, false;
          if (offensive.has(n)) return removed.offensive++, false;
          return true;
        })
        .sort((a, b) => b[1].zipf - a[1].zipf || a[0].localeCompare(b[0]))
        .slice(0, CONFIG[lang][length].maxAnswers);

      for (const raw of allowlist) {
        const n = normalizeWord(raw);
        if (n.length !== length || !isInAlphabet(n, lang) || ranked.some(([w]) => w === n)) continue;
        ranked.push([n, { zipf: 0, form: raw.toLowerCase(), note: 'allowlist' }]);
        allowed.add(n);
      }

      const answers = shuffle(
        ranked.map(([n]) => n).sort(),
        seededRng(SHUFFLE_SEED, lang, length),
      );
      if (lang === 'es') {
        for (const [n, c] of ranked) if (normalizeWord(c.form) === n && c.form.toUpperCase() !== n) accents[n] = c.form;
      }

      // Comprobaciones de integridad antes de escribir nada.
      for (const a of answers) {
        if (!allowed.has(a)) throw new Error(`${lang}/${length}: ${a} está en answers pero no en allowed`);
      }

      const dir = path.join(OUT, lang, String(length));
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'answers.json'), `${JSON.stringify(answers)}\n`);
      writeFileSync(path.join(dir, 'allowed.json'), `${JSON.stringify([...allowed].sort())}\n`);

      report.push(`| ${lang} | ${length} | ${allowed.size} | ${answers.length} |`);

      const byFreq = ranked.map(([n, c]) => c.form || n);
      const flagless = ranked.filter(([, c]) => c.note === 'flagless').map(([, c]) => c.form);
      details.push(
        `## ${lang.toUpperCase()} · ${length} letras`,
        '',
        `- Palabras del diccionario: ${built.stats.dictionary}`,
        ...Object.entries(built.stats)
          .filter(([k]) => k !== 'dictionary')
          .map(([k, v]) => `- Descartadas como solución (${k}): ${v}`),
        `- Quitadas por blocklist: ${removed.blocklist}`,
        `- Quitadas por lista de términos ofensivos: ${removed.offensive}`,
        `- Soluciones finales: ${answers.length} (Zipf mínimo ${CONFIG[lang][length].minZipf})`,
        '',
        '**Más frecuentes (40):** ' + byFreq.slice(0, 40).join(', '),
        '',
        '**Menos frecuentes (40):** ' + byFreq.slice(-40).join(', '),
        '',
        ...(flagless.length
          ? [`**Raíces sin flags de afijos (revisar: pueden ser formas verbales irregulares) — ${flagless.length}:** ${flagless.join(', ')}`, '']
          : []),
      );
      console.log(`✓ ${lang}/${length}: allowed=${allowed.size} answers=${answers.length}`);
    }
  }

  writeFileSync(path.join(OUT, 'es', 'accents.json'), `${JSON.stringify(accents, Object.keys(accents).sort())}\n`);
  writeFileSync(path.join(ROOT, 'data', 'REPORT.md'), [...report, '', ...details].join('\n'));
  console.log('✓ data/REPORT.md');
}

main();
