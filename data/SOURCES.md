# Fuentes de palabras

Todas las fuentes se descargan con `pnpm words:fetch` desde una URL fija y se verifican con SHA-256 (ver `scripts/fetch-sources.ts`). Los archivos originales quedan en `data/raw/`, que no se versiona. Las listas generadas en `src/words/` sí se versionan.

Licencias verificadas el 2026-09-15.

| Fuente | Versión | Uso en Wordkstate | Licencia |
|---|---|---|---|
| [SCOWL](https://wordlist.aspell.net/) — Kevin Atkinson | 2020.12.07 (`scowl-2020.12.07.tar.gz`) | Inglés: diccionario. Niveles ≤ 80 para intentos válidos; niveles ≤ 50 para candidatas a solución | Permisiva, estilo MIT (ver `data/raw/scowl/Copyright`) |
| [RLA-ES](https://github.com/sbosio/rla-es) — Santiago Bosio y colaboradores | v2.9, diccionario general `es` (`es.oxt`) | Español: diccionario Hunspell (`es.dic` + `es.aff`) expandido. Las raíces son candidatas a solución; todas las formas son intentos válidos | Tri-licencia GPL-3.0+ / LGPL-3.0+ / MPL-1.1+ (se elige **MPL-1.1**) |
| [wordfreq](https://github.com/rspeer/wordfreq) — Robyn Speer | 3.1.1 (datos `large_en`, `large_es`) | Frecuencia de uso (Zipf) para elegir soluciones comunes | Código Apache-2.0; datos **CC BY-SA 4.0** |
| [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) | commit `5faf2ba` (listas `en`, `es`) | Filtro de términos ofensivos en soluciones | CC BY 4.0 |

## Notas de licencia

- **CC BY-SA 4.0 (wordfreq):** la frecuencia se usa solo como criterio de selección; no se redistribuyen los conteos. Aun así, por prudencia, las listas generadas en `src/words/` se publican bajo **CC BY-SA 4.0** con atribución a todas las fuentes (página `/es/creditos` y `/en/credits`).
- **RLA-ES:** las listas derivadas del diccionario se ofrecen bajo MPL-1.1, una de las tres licencias disponibles, y el aviso se incluye en la página de créditos.
- **SCOWL:** exige conservar el aviso de copyright, que está en la página de créditos.

## Desviaciones respecto al plan

- **Inglés, `allowed`:** se usan los niveles de SCOWL ≤ 80, no ≤ 70. Con ≤ 70 las listas quedaban por debajo de 10 000 palabras (6 421 de 5 letras).
- **Inglés, soluciones:** se usan niveles ≤ 50, no ≤ 35. Así hay más variedad; la frecuencia mínima sigue filtrando las palabras raras.
- **ENABLE:** no se usó. SCOWL ≤ 80 ya supera el tamaño objetivo.
- **Español, 5 letras:** `allowed` tiene 9 124 palabras, algo menos que el objetivo de 10 000. Se comprobó que las palabras frecuentes de 5 letras que faltan son nombres propios o extranjerismos (Pablo, López, Trump…), así que el diccionario no está incompleto: es el vocabulario real de 5 letras.
- **Variantes regionales:** el diccionario `es` de RLA-ES ya es la unión de todas las localizaciones (es_AR … es_VE), así que no hizo falta combinar diccionarios. Los regionalismos poco conocidos quedan fuera por frecuencia, porque wordfreq mide corpus de todo el mundo hispano.
