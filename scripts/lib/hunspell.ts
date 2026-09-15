/**
 * Expansor mínimo de diccionarios Hunspell (.aff + .dic).
 *
 * Genera todas las formas de cada raíz aplicando sufijos, prefijos,
 * productos cruzados y sufijos dobles (flags de continuación). No pretende
 * cubrir todo Hunspell (compuestos, NEEDAFFIX, etc.): solo lo que usa RLA-ES.
 */

type Affix = {
  kind: 'PFX' | 'SFX';
  flag: string;
  cross: boolean;
  strip: string;
  add: string;
  cont: string[];
  cond: RegExp;
};

export type HunspellEntry = { word: string; flags: string[] };

export type Hunspell = {
  entries: HunspellEntry[];
  /** Todas las formas generadas para una raíz (incluida la raíz). */
  expand(entry: HunspellEntry): Set<string>;
};

/** Divide una cadena de flags UTF-8 en flags individuales (une selectores de variación). */
function splitFlags(s: string): string[] {
  const out: string[] = [];
  for (const ch of Array.from(s)) {
    if (/[︎️‍]/.test(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

export function parseHunspell(affText: string, dicText: string): Hunspell {
  const byFlag = new Map<string, Affix[]>();

  for (const raw of affText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^(PFX|SFX)\s/.test(line)) continue;
    const parts = line.split(/\s+/);
    const [kind, flag] = parts as ['PFX' | 'SFX', string];
    // Cabecera: "SFX A Y 14"
    if (parts.length === 4 && /^[YN]$/.test(parts[2]) && /^\d+$/.test(parts[3])) {
      if (!byFlag.has(flag)) byFlag.set(flag, []);
      (byFlag.get(flag) as Affix[] & { cross?: boolean }).cross = parts[2] === 'Y';
      continue;
    }
    const list = byFlag.get(flag);
    if (!list) continue;
    const strip = parts[2] === '0' ? '' : parts[2];
    const [addRaw, contRaw = ''] = (parts[3] ?? '').split('/');
    const add = addRaw === '0' ? '' : addRaw;
    const condRaw = parts[4] ?? '.';
    const cond = condRaw === '.' ? /./u : kind === 'SFX' ? new RegExp(`${condRaw}$`, 'u') : new RegExp(`^${condRaw}`, 'u');
    list.push({
      kind,
      flag,
      cross: Boolean((list as Affix[] & { cross?: boolean }).cross),
      strip,
      add,
      cont: splitFlags(contRaw),
      cond,
    });
  }

  const entries: HunspellEntry[] = [];
  const lines = dicText.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const token = lines[i].trim().split(/\s+/)[0];
    if (!token) continue;
    const slash = token.search(/(?<!\\)\//);
    const word = (slash === -1 ? token : token.slice(0, slash)).replace(/\\\//g, '/');
    const flags = slash === -1 ? [] : splitFlags(token.slice(slash + 1));
    entries.push({ word, flags });
  }

  const applySuffix = (word: string, a: Affix): string | null => {
    if (!word.endsWith(a.strip) || !a.cond.test(word)) return null;
    const base = word.slice(0, word.length - a.strip.length);
    return base.length ? base + a.add : null;
  };
  const applyPrefix = (word: string, a: Affix): string | null => {
    if (!word.startsWith(a.strip) || !a.cond.test(word)) return null;
    const base = word.slice(a.strip.length);
    return base.length ? a.add + base : null;
  };

  const affixesOf = (flags: string[], kind: 'PFX' | 'SFX') =>
    flags.flatMap((f) => (byFlag.get(f) ?? []).filter((a) => a.kind === kind));

  function expand(entry: HunspellEntry): Set<string> {
    const forms = new Set<string>([entry.word]);
    const suffixed: { form: string; cross: boolean }[] = [];

    for (const s1 of affixesOf(entry.flags, 'SFX')) {
      const f1 = applySuffix(entry.word, s1);
      if (!f1) continue;
      forms.add(f1);
      suffixed.push({ form: f1, cross: s1.cross });
      // Sufijo doble: el primer sufijo habilita otros mediante flags de continuación.
      for (const s2 of affixesOf(s1.cont, 'SFX')) {
        const f2 = applySuffix(f1, s2);
        if (f2) {
          forms.add(f2);
          suffixed.push({ form: f2, cross: s1.cross && s2.cross });
        }
      }
    }

    for (const p of affixesOf(entry.flags, 'PFX')) {
      const fp = applyPrefix(entry.word, p);
      if (fp) forms.add(fp);
      if (!p.cross) continue;
      for (const s of suffixed) {
        if (!s.cross) continue;
        const fps = applyPrefix(s.form, p);
        if (fps) forms.add(fps);
      }
    }
    return forms;
  }

  return { entries, expand };
}
