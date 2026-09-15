/**
 * Descarga las fuentes de palabras a data/raw/ con URL y checksum fijos.
 *
 *   pnpm words:fetch
 *
 * Si un checksum no coincide el script falla: la fuente cambió y hay que
 * revisarla (y actualizar data/SOURCES.md) antes de aceptar el nuevo valor.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, unzipSync } from 'fflate';

const RAW_DIR = path.join(process.cwd(), 'data', 'raw');

type Source = {
  id: string;
  url: string;
  sha256: string;
  file: string;
};

export const SOURCES: Source[] = [
  {
    id: 'scowl',
    url: 'https://downloads.sourceforge.net/wordlist/scowl-2020.12.07.tar.gz',
    sha256: '5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc',
    file: 'scowl-2020.12.07.tar.gz',
  },
  {
    id: 'rla-es',
    url: 'https://github.com/sbosio/rla-es/releases/download/v2.9/es.oxt',
    sha256: 'b08a1a0e3e044697f63a67184f591f7e2c37bbb53bbfbb4780bcbd84929d6e8c',
    file: 'rla-es-2.9-es.oxt',
  },
  {
    id: 'wordfreq',
    url: 'https://files.pythonhosted.org/packages/24/61/62835c475d69872d30689f284497853fe33fe1d6dd18f57346d13305861d/wordfreq-3.1.1-py3-none-any.whl',
    sha256: '4b1c6ecffc6198be3396d5cf871c4423ca71c907c231348d352dd54d62b97473',
    file: 'wordfreq-3.1.1-py3-none-any.whl',
  },
  {
    id: 'ldnoobw-en',
    url: 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/5faf2ba42d7b1c0977169ec3611df25a3c08eb13/en',
    sha256: 'af851ecef1d5f212caba17339b12ac39cc2fef7d78c74876f67237644fcee8bd',
    file: 'ldnoobw-en.txt',
  },
  {
    id: 'ldnoobw-es',
    url: 'https://raw.githubusercontent.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words/5faf2ba42d7b1c0977169ec3611df25a3c08eb13/es',
    sha256: '073334261cc2e7c08339faefd2f19f9623e8240a0ac18fe2a26c368b897496ce',
    file: 'ldnoobw-es.txt',
  },
];

const sha256 = (buf: Uint8Array) => createHash('sha256').update(buf).digest('hex');

async function download(src: Source): Promise<Uint8Array> {
  const target = path.join(RAW_DIR, src.file);
  let buf: Uint8Array;
  if (existsSync(target)) {
    buf = readFileSync(target);
  } else {
    console.log(`↓ ${src.id}  ${src.url}`);
    const res = await fetch(src.url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`${src.id}: HTTP ${res.status}`);
    buf = new Uint8Array(await res.arrayBuffer());
    writeFileSync(target, buf);
  }
  const actual = sha256(buf);
  if (src.sha256 && actual !== src.sha256) {
    throw new Error(`${src.id}: checksum distinto.\n  esperado ${src.sha256}\n  obtenido ${actual}`);
  }
  if (!src.sha256) console.warn(`⚠ ${src.id}: sin checksum fijado (sha256 ${actual})`);
  return buf;
}

/** Lector mínimo de tar (ustar) — suficiente para el tarball de SCOWL. */
function untar(buf: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  const dec = new TextDecoder('latin1');
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start: number, len: number) =>
      dec.decode(header.subarray(start, start + len)).replace(/\0.*$/s, '').trim();
    const name = field(345, 155) ? `${field(345, 155)}/${field(0, 100)}` : field(0, 100);
    const size = parseInt(field(124, 12) || '0', 8);
    const type = field(156, 1);
    off += 512;
    if (type === '0' || type === '') files.set(name, buf.slice(off, off + size));
    off += Math.ceil(size / 512) * 512;
  }
  return files;
}

function extract(src: Source, buf: Uint8Array) {
  const out = (name: string, data: Uint8Array) => {
    const p = path.join(RAW_DIR, src.id, name);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, data);
  };

  switch (src.id) {
    case 'scowl': {
      const files = untar(gunzipSync(buf));
      let n = 0;
      for (const [name, data] of files) {
        const m = name.match(/final\/((?:english|american)-(?:words|upper|proper-names|abbreviations|contractions)\.\d+)$/);
        if (m) {
          out(m[1], data);
          n++;
        }
        if (name.endsWith('/Copyright')) out('Copyright', data);
      }
      console.log(`  scowl: ${n} archivos`);
      break;
    }
    case 'rla-es': {
      const files = unzipSync(buf);
      for (const [name, data] of Object.entries(files)) {
        if (/\.(dic|aff)$/.test(name) || /^(README|LICENSE|Copying|GPL|LGPL|MPL)/i.test(path.basename(name))) {
          out(path.basename(name), data);
        }
      }
      break;
    }
    case 'wordfreq': {
      const files = unzipSync(buf, {
        filter: (f) => /wordfreq\/data\/large_(en|es)\.msgpack\.gz$/.test(f.name) || /LICENSE/i.test(f.name),
      });
      for (const [name, data] of Object.entries(files)) out(path.basename(name), data);
      break;
    }
    default:
      break;
  }
}

async function main() {
  mkdirSync(RAW_DIR, { recursive: true });
  for (const src of SOURCES) {
    const buf = await download(src);
    extract(src, buf);
    console.log(`✓ ${src.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
