/**
 * Lector de los datos de wordfreq (formato "cBpack": msgpack comprimido con gzip).
 *
 * El archivo es una lista cuyo primer elemento es una cabecera y cada elemento
 * siguiente, en la posición i, contiene las palabras con frecuencia -i centibels.
 * Zipf = log10(frecuencia por mil millones de palabras) = 9 - i / 100.
 */
import { readFileSync } from 'node:fs';
import { decode } from '@msgpack/msgpack';
import { gunzipSync } from 'fflate';

export function loadZipf(file: string): Map<string, number> {
  const data = decode(gunzipSync(readFileSync(file))) as unknown[];
  const header = data[0] as { format?: string; version?: number };
  if (header?.format !== 'cB') throw new Error(`Formato wordfreq inesperado en ${file}`);

  const zipf = new Map<string, number>();
  for (let i = 1; i < data.length; i++) {
    const value = Math.round((9 - (i - 1) / 100) * 100) / 100;
    for (const word of data[i] as string[]) {
      if (!zipf.has(word)) zipf.set(word, value);
    }
  }
  return zipf;
}
