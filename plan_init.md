# Plan inicial — Wordkstate

Juego de adivinanzas diario inspirado en Wordle, en **español** e **inglés**, hospedado en **Vercel**.

> ## Estado de implementación (2026-09-15)
>
> | Fase | Estado |
> |---|---|
> | 0 — Setup | ✅ Next.js 16 + TypeScript + Tailwind 4 + Vitest + Playwright + CI (GitHub Actions) |
> | 1 — Fuentes y pipeline | ✅ `pnpm words:fetch` / `pnpm words:build`; 8 listas generadas y curadas (ver `data/REPORT.md`, `data/SOURCES.md`) |
> | 2 — Núcleo de juegos | ✅ `src/lib/*`, `src/server/*`, `/api/guess`, `/api/practice/new`, `/api/reveal` |
> | 3 — UI de palabras | ✅ Tableros 5×6 y 6×7, animaciones, teclado, modales, modo oscuro, alto contraste, modo difícil |
> | 4 — Juego de fecha | ✅ Implementado con flechas opcionales. ⏳ Falta la prueba de juego con personas para ajustar los 6 intentos |
> | 5 — i18n, menú, práctica | ✅ `/es` y `/en` con slugs traducidos y práctica en los tres juegos |
> | 6 — Calidad y lanzamiento | ✅ 66 pruebas unitarias y 22 E2E (escritorio + móvil). ⏳ Falta medir Lighthouse y configurar Vercel (§11.1), que se hará en conjunto |
>
> **Tamaños finales:** en/5: 1 621 soluciones y 11 088 intentos válidos · en/6: 1 860 / 19 631 · es/5: 1 231 / 9 124 · es/6: 1 487 / 21 622.
>
> **Desviaciones respecto al plan** (detalle en `data/SOURCES.md`):
> - SCOWL: niveles ≤ 80 para `allowed` y ≤ 50 para soluciones, en vez de ≤ 70 y ≤ 35.
> - ENABLE no se usa.
> - es/5 tiene 9 124 intentos válidos: es todo el vocabulario de 5 letras del diccionario.
> - El orden de las soluciones diarias se baraja en el servidor con `WORD_SEED`, además del barajado fijo del pipeline.
> - Textos de interfaz en `src/i18n/{es,en}.ts` (TypeScript tipado) en lugar de JSON.

## 1. Objetivo

Construir **Wordkstate**, con tres juegos:

| Juego | Qué se adivina | Casillas | Intentos | Idiomas |
|---|---|---|---|---|
| **Palabra de 5** | Palabra de 5 letras | 5 | 6 | ES / EN (listas distintas) |
| **Palabra de 6** | Palabra de 6 letras | 6 | 7 | ES / EN (listas distintas) |
| **Fecha** | Fecha oculta (día, mes, año) | 8 dígitos | 6 (ajustable tras pruebas) | Único juego; solo cambia el formato de fecha y la interfaz |

Cada juego tiene:

- **Reto diario:** misma solución para todos los jugadores ese día.
- **Modo práctica:** partidas aleatorias ilimitadas.
- Validación de cada intento (palabra real del idioma / fecha real del calendario).
- Estadísticas propias.

Las listas de palabras se **generan a partir de fuentes abiertas, con licencia clara y de forma reproducible**. No se copian a mano ni se toman de otro clon.

### 1.1 Decisiones tomadas

| # | Decisión |
|---|---|
| 1 | Tres juegos: palabra de 5 letras (6 intentos), palabra de 6 letras (7 intentos) y fecha oculta |
| 2 | Las tildes y la diéresis se ignoran al jugar; la `Ñ` es una letra propia |
| 3 | Se usa el español general, con todas las variantes regionales (no solo `es_ES`) |
| 4 | Nombre público: **Wordkstate**. No se usa la marca "Wordle" |
| 5 | Rango del juego de fecha: desde el **01/01/1900 hasta el día del reto** (nunca fechas futuras) |
| 6 | Flechas ↑/↓ del juego de fecha: **opcionales**, desactivadas por defecto |
| 7 | Juego de fecha: se empieza con **6 intentos** y se ajusta tras las pruebas de juego |
| 8 | Dominio: subdominio gratuito de Vercel (`wordkstate.vercel.app`). La configuración se hace al final, en la Fase 6 (ver §11.1) |

### 1.2 Reglas de los juegos de palabras

- Cada intento debe ser una palabra válida del idioma con la longitud del juego.
- Colores por letra: **verde** (letra y posición correctas), **amarillo** (está en otra posición), **gris** (no está).
- Las letras repetidas se evalúan como en el original (ver §7.3).
- El teclado en pantalla muestra el mejor estado conocido de cada letra.
- Modo difícil opcional: las pistas reveladas deben usarse en los siguientes intentos.

### 1.3 Reglas del juego de fecha

- La solución es una **fecha válida del calendario** entre el `01/01/1900` y **el día del reto** (incluido). El límite superior avanza cada día; nunca hay fechas futuras.
- El jugador escribe 8 dígitos. El formato visible depende del idioma:
  - ES: `DD / MM / AAAA`
  - EN: `MM / DD / YYYY`
- Cada intento debe ser una **fecha real** (se rechazan `31/02/2020` o `29/02/2023`), no anterior a 1900 y no posterior al día del reto. Es el equivalente a "palabra no válida".
- Colores por dígito, con la misma lógica que Wordle:
  - **verde:** dígito correcto en esa posición del mismo campo.
  - **amarillo:** el dígito está en otra posición de la fecha.
  - **gris:** no está (o ya se contaron todas sus apariciones).
- **Flechas opcionales:** una flecha ↑/↓ (o `=`) por campo (día, mes, año) que indica si el valor real es mayor, menor o igual.
  - Se activan en la configuración y vienen **desactivadas por defecto**.
  - Igual que el modo difícil de Wordle, solo se pueden cambiar **antes del primer intento** de la partida; después quedan fijas.
  - El resultado compartido indica si se jugó con flechas (p. ej. `Wordkstate Fecha #123 4/6 ↕`).
- Teclado numérico en pantalla (0–9, borrar, enviar) y teclado físico. El cursor salta solo los separadores.

---

## 2. El reto principal: fuente confiable de palabras

Hacen falta **dos listas por idioma y por longitud** (5 y 6), es decir, 8 listas en total:

| Lista | Propósito | Criterio | Tamaño objetivo (por idioma y longitud) |
|---|---|---|---|
| `answers` (soluciones) | Palabras que pueden salir como reto | Comunes y reconocibles. Sin plurales ni conjugaciones raras, nombres propios ni groserías | 1 000 – 2 500 (≈ 3–7 años de retos diarios) |
| `allowed` (intentos válidos) | Palabras aceptadas como intento | Cualquier palabra real de esa longitud, incluidos plurales y conjugaciones | 10 000 – 40 000 |

Siempre se cumple `answers ⊆ allowed`.

La estrategia combina **un diccionario ortográfico** (¿la palabra existe?) con **una lista de frecuencias** (¿la gente la conoce?). Ninguna de las dos basta sola: los diccionarios incluyen palabras rarísimas y las listas de frecuencia traen errores, nombres propios y ruido de subtítulos.

El juego de fecha **no necesita fuentes externas**: su "diccionario" es el calendario.

### 2.1 Fuentes candidatas — Inglés

| Fuente | Qué aporta | Licencia (verificar en Fase 1) | Uso |
|---|---|---|---|
| **SCOWL** (Spell Checker Oriented Word Lists, Kevin Atkinson) — `github.com/en-wl/wordlist` | Diccionario por niveles de "tamaño" (10 → 95). Los niveles bajos son palabras comunes | Permisiva, tipo MIT/BSD | `allowed` (niveles ≤ 70) y candidatos a `answers` (niveles ≤ 35) |
| **ENABLE / ENABLE2K** | Lista clásica de juegos de palabras | Dominio público | Respaldo / unión para `allowed` |
| **wordfreq** (Robyn Speer) | Frecuencia de uso (escala Zipf) combinando varios corpus | Código Apache-2.0, datos CC BY-SA 4.0 | Ordenar candidatos a `answers` por frecuencia |
| **hermitdave/FrequencyWords** (OpenSubtitles) | Frecuencia coloquial | Código MIT, datos CC BY-SA 4.0 | Alternativa / validación cruzada de frecuencia |

> No se usarán las listas originales de NYT Wordle que circulan en gists, porque su licencia no es clara.

### 2.2 Fuentes candidatas — Español (general)

| Fuente | Qué aporta | Licencia (verificar en Fase 1) | Uso |
|---|---|---|---|
| **Diccionarios Hunspell del proyecto RLA-ES** (los de LibreOffice/Firefox) — `github.com/sbosio/rla-es` | Raíces (`.dic`) + reglas de afijos (`.aff`). Al expandirlas generan plurales y conjugaciones. Se usa el **diccionario general `es`**, que une las variantes regionales | Tri-licencia GPL / LGPL / MPL | Raíces → candidatos a `answers`; formas expandidas → `allowed` |
| **wordfreq** (español) | Frecuencia de uso | Apache-2.0 / CC BY-SA 4.0 | Ordenar candidatos a `answers` |
| **hermitdave/FrequencyWords** (`es`) | Frecuencia coloquial | MIT / CC BY-SA 4.0 | Validación cruzada |
| **Leipzig Corpora Collection** (es) | Frecuencias de corpus de noticias y web | CC BY | Alternativa si wordfreq no alcanza |

> La RAE no publica su diccionario con licencia abierta, así que no se hará scraping del DLE.

**Variantes regionales:** si el diccionario general no trae la unión completa, se unen los localizados (`es_MX`, `es_AR`, `es_CO`, `es_ES`, etc.) en `allowed`. Para `answers` se prefieren palabras presentes en **varias** variantes y con frecuencia alta, así se evitan soluciones que solo conoce un país.

### 2.3 Filtros comunes

- **Groserías / términos ofensivos:** lista *LDNOOBW* ("List of Dirty, Naughty, Obscene and Otherwise Bad Words", CC BY 4.0), disponible en `en` y `es`. Se excluyen de `answers`, pero pueden seguir en `allowed`.
- **Nombres propios:** se excluyen las entradas con mayúscula inicial en el diccionario.
- **Lista negra manual:** `data/blocklist.<lang>.txt`, versionada, para quitar palabras que pasen los filtros pero no convengan.
- **Lista blanca manual:** `data/allowlist.<lang>.txt`, para forzar palabras que falten.

Ambas listas manuales contienen palabras de cualquier longitud; el pipeline las reparte por longitud.

### 2.4 Normalización del español

- Pasar a mayúsculas y aplicar Unicode NFD.
- **Quitar tildes y diéresis** (`á→A`, `é→E`, `ü→U`). El jugador no escribe acentos.
- **La `Ñ` es una letra propia** y se conserva: se protege antes de quitar los diacríticos.
- Después de normalizar, **deduplicar** (`PAPÁ` y `PAPA` → `PAPA`).
- La longitud se mide **después** de normalizar: exactamente 5 o 6 letras del alfabeto `A–Z` + `Ñ`.
- Se guarda un mapa `normalizada → formas acentuadas` (`PAPA → papá, papa`) para mostrar la palabra con su ortografía real al terminar la partida.

---

## 3. Pipeline de generación de listas (en local, antes del build)

Un script en Node/TypeScript (`scripts/build-words.ts`) se ejecuta **en local** y su resultado se versiona en el repo. El build de Vercel no descarga fuentes: es más rápido, siempre da el mismo resultado y no depende de terceros en cada deploy.

```
data/raw/            ← fuentes descargadas (no versionadas), con versión/fecha anotada
data/blocklist.*.txt ← curación manual
data/allowlist.*.txt
data/SOURCES.md      ← URL, commit/versión, fecha, licencia y checksum de cada fuente
data/REPORT.md       ← estadísticas generadas: tamaños, muestras, descartes por filtro
scripts/fetch-sources.ts   ← descarga fuentes con URL + checksum fijos
scripts/build-words.ts     ← genera las listas
src/words/en/5/answers.json   src/words/en/5/allowed.json
src/words/en/6/answers.json   src/words/en/6/allowed.json
src/words/es/5/answers.json   src/words/es/5/allowed.json
src/words/es/6/answers.json   src/words/es/6/allowed.json
src/words/es/accents.json     ← mapa normalizada → formas acentuadas
```

### Pasos del script (por idioma; las longitudes 5 y 6 salen de la misma pasada)

1. **Cargar el diccionario.**
   - EN: unir los niveles SCOWL ≤ 70 (+ ENABLE).
   - ES: expandir Hunspell (`.dic` + `.aff`) del diccionario general (+ variantes regionales si hace falta). Para expandir se puede usar la herramienta `unmunch`/`wordforms` de Hunspell o una librería JS (p. ej. `nspell`). Se guardan por separado las **raíces** y las **formas expandidas**.
2. **Normalizar** (§2.4) y separar por longitud (5 y 6).
3. **`allowed`** = todas las formas normalizadas de esa longitud + allowlist. Las groserías sí se permiten como intento.
4. **Candidatos a `answers`:**
   - EN: palabras SCOWL de nivel ≤ 35. Se excluyen:
     - plurales regulares (terminadas en `S` cuya raíz también existe);
     - pasados en `-ED`;
     - en la lista de 6 letras, derivadas triviales de una palabra de 5 (`CRANE → CRANES`, `CRANED`).
   - ES: solo **raíces** del `.dic` (sustantivos en singular, adjetivos, adverbios, infinitivos), sin formas verbales conjugadas ni plurales.
5. **Puntuar por frecuencia** (wordfreq Zipf) y quedarse con las que superen un umbral **por longitud** (las de 6 letras suelen tener menos frecuencia, así que el umbral se ajusta para alcanzar el tamaño objetivo).
6. **Aplicar** la blocklist, el filtro de groserías y el de nombres propios; añadir la allowlist.
7. **Revisión humana** de cada lista `answers` (una pasada rápida, documentada en `REPORT.md`).
8. **Barajar** cada `answers` con un generador pseudoaleatorio con semilla (p. ej. mulberry32). Ese orden define el reto de cada día.
9. **Emitir** los JSON y `REPORT.md`.
10. **Tests del pipeline**, para cada una de las 8 listas:
    - `answers ⊆ allowed`;
    - longitud exacta;
    - sin duplicados;
    - sin caracteres fuera del alfabeto;
    - tamaño dentro del rango esperado.

### Atribución

La página `/creditos` (y una sección del README) lista cada fuente con su autor y licencia, como exigen CC BY y CC BY-SA.

> **Nota sobre CC BY-SA:** las listas derivadas de datos CC BY-SA (wordfreq, FrequencyWords) podrían considerarse obra derivada. Mitigación: la frecuencia se usa **solo como criterio de selección** (los conteos no se redistribuyen) y, aun así, se atribuye y las listas se publican bajo CC BY-SA 4.0. Confirmar en la Fase 1.

---

## 4. Stack tecnológico (compatible con Vercel)

| Área | Elección | Motivo |
|---|---|---|
| Framework | **Next.js** (App Router, última versión estable) + **TypeScript** | Soporte nativo y de primera clase en Vercel; SSG + Route Handlers en un solo proyecto |
| Estilos | **Tailwind CSS** | Rápido para una UI pequeña, buen soporte de modo oscuro |
| Estado | `useReducer` + contexto (o **Zustand** si crece) | El estado de cada partida es simple y local |
| i18n | Rutas por idioma `/es` y `/en` + diccionarios de textos (`next-intl` o JSON propio) | URLs compartibles por idioma, SEO |
| Persistencia del jugador | `localStorage` | Estadísticas y partida en curso, sin backend ni cuentas |
| Validación de intentos | **Route Handler** (`/api/guess`) en runtime Node en Vercel | La solución no se expone en el código del cliente |
| Tokens de práctica | Cifrado autenticado **AES-GCM** (Web Crypto) | Sin base de datos y sin revelar la solución |
| Tests | **Vitest** (lógica y pipeline) + **Playwright** (E2E) | Estándar del ecosistema |
| Gestor de paquetes | **pnpm** | Soportado por Vercel |
| CI/CD | Integración Git de Vercel (preview por PR, producción en `main`) + GitHub Actions para tests | Sin configuración extra |

El MVP no lleva base de datos. Si más adelante se quieren estadísticas globales, se evaluará un almacén KV del Marketplace de Vercel (p. ej. Upstash Redis).

---

## 5. Arquitectura

```
Navegador                                   Vercel
┌──────────────────────────┐        ┌──────────────────────────────────┐
│ /es  /en  (páginas SSG)  │        │ Route Handlers (Node)            │
│  - Menú de juegos        │        │  /api/guess                      │
│  - Tablero + teclado     │  POST  │   · valida juego, idioma, fecha  │
│    (letras o numérico)   ├───────►│   · verifica intento válido      │
│  - Estado en localStorage│◄───────┤   · calcula colores vs solución  │
│  - Textos i18n           │  JSON  │  /api/practice/new               │
└──────────────────────────┘        │  /api/reveal (al terminar)       │
                                    │                                  │
                                    │  src/words/{es,en}/{5,6}/*.json  │
                                    │  src/lib/games/{word,date}.ts    │
                                    └──────────────────────────────────┘
```

### 5.1 Juegos como módulos

Cada juego implementa la misma interfaz en `src/lib/games/`. Así la API, el tablero y las estadísticas son genéricos:

```ts
interface GameDefinition<Guess> {
  id: 'w5' | 'w6' | 'date';
  length: number;            // 5, 6 u 8
  maxAttempts: number;       // 6, 7 o 6
  alphabet: 'letters-en' | 'letters-es' | 'digits';
  isValidGuess(guess: Guess, lang: Lang): boolean;
  dailySolution(dayIndex: number, lang: Lang): Guess;
  randomSolution(rng: () => number, lang: Lang): Guess;
  evaluate(guess: Guess, solution: Guess): TileResult[];
  hints?(guess: Guess, solution: Guess): FieldHint[]; // flechas ↑/↓ del juego de fecha
}
```

### 5.2 ¿Por qué validar en el servidor?

El Wordle original tenía toda la lista, y su orden, en el JavaScript del cliente: cualquiera podía ver las respuestas futuras. Con Route Handlers la solución **nunca** llega al navegador antes de terminar la partida. El coste es mínimo: funciones ligeras con las listas en memoria.

Se descarta un MVP 100 % estático con un hash de la solución: un hash de 5–6 letras o de una fecha se rompe por fuerza bruta en segundos.

### 5.3 Reto diario

- `dayIndex = díasEntre(START_DATE, fechaLocalDelJugador)`
- **Palabras:** `solución = answers[lang][len][(dayIndex + offset) % answers.length]`
- **Fecha:** `solución = fechaAleatoria(prng(hash(WORD_SEED, "date", dayIndex)), desde = 1900-01-01, hasta = fechaDelReto)`, uniforme dentro del rango. Como el límite superior depende del propio `dayIndex`, el resultado es determinista. Es **la misma para ambos idiomas**; solo cambia cómo se muestra.
- El cliente envía su **fecha local** (`YYYY-MM-DD`). El servidor la acepta solo si está a ±1 día de su fecha UTC: eso cubre todas las zonas horarias e impide adelantarse a días futuros.
- `offset` y las semillas salen de variables de entorno (`WORD_SEED`), así que las respuestas no se deducen leyendo el repo público.
- Numeración para compartir: `Wordkstate 5 #123`, `Wordkstate 6 #123`, `Wordkstate Fecha #123` / `Wordkstate Date #123`.

### 5.4 Modo práctica

- `/api/practice/new` elige una solución aleatoria y devuelve un **token cifrado** (AES-GCM con `GAME_SECRET`) que contiene `{game, lang, solutionRef, createdOn, dateHints}`:
  - `solutionRef`: el índice en la lista (palabras) o la fecha solución (fecha);
  - `createdOn`: la fecha del servidor al crear la partida, que marca el límite superior de los intentos del juego de fecha;
  - `dateHints`: si la partida de fecha se juega con flechas.
- El cliente reenvía el token en cada `/api/guess`. No hace falta base de datos y, como va cifrado, el token no revela la solución (un token solo firmado sí la dejaría ver).

### 5.5 Contrato de API (borrador)

`POST /api/guess`
```json
// palabra, reto diario
{ "game": "w5", "lang": "es", "mode": "daily", "date": "2026-09-15", "guess": "ARBOL" }

// palabra de 6, práctica
{ "game": "w6", "lang": "en", "mode": "practice", "token": "<aes-gcm>", "guess": "PLANET" }

// fecha — el intento siempre viaja en formato canónico ISO, sin importar el idioma
// "hints" refleja la preferencia fijada al inicio de la partida
{ "game": "date", "lang": "es", "mode": "daily", "date": "2026-09-15", "guess": "1969-07-20", "hints": true }

// respuesta 200 — intento válido
{ "valid": true, "result": ["correct","absent","present","absent","absent"], "solved": false }

// respuesta 200 — fecha con flechas activadas (sin ellas no se incluye "hints")
{ "valid": true, "result": ["absent", "..."], "hints": { "day": "up", "month": "equal", "year": "down" }, "solved": false }

// respuesta 200 — intento no válido
{ "valid": false, "reason": "not_in_word_list" }   // o "invalid_date" / "before_1900" / "future_date"
```

`POST /api/reveal` devuelve la solución (y, en español, su forma acentuada) solo si el cliente envía todos los intentos fallidos o si la partida ya está resuelta. La validación es ligera: se trata de un juego y el objetivo es evitar spoilers accidentales, no ofrecer seguridad fuerte.

---

## 6. Juego de fecha — detalles

### 6.1 Representación

- **Canónica (servidor, API, almacenamiento):** `YYYY-MM-DD`.
- **Casillas (evaluación):** 8 dígitos en orden canónico `Y Y Y Y M M D D`.
- **Visual:** el cliente reordena las casillas según el idioma (ES `DD MM AAAA`, EN `MM DD YYYY`) con separadores `/`.

Como el color "verde" depende de la posición dentro de cada campo y el "amarillo" es independiente del orden, evaluar sobre el orden canónico y reordenar después da el mismo resultado en ambos idiomas.

### 6.2 Validación

- Fecha real, con años bisiestos correctos (regla gregoriana 4/100/400).
- Entre `1900-01-01` y la fecha del reto, ambas incluidas:
  - reto diario: la fecha del reto es la que envía el cliente, validada a ±1 día;
  - práctica: la fecha UTC del servidor en el momento de crear la partida, guardada dentro del token.
- La interfaz avisa **antes** de enviar si el mes es > 12, si el día no existe en ese mes o si la fecha es futura.

### 6.3 Dificultad

- 6 intentos para 8 dígitos. La restricción de "fecha real" y el rango limitado reducen mucho el espacio de búsqueda: hoy son ≈ 46 000 fechas y crecen 365 al año.
- Los dos primeros dígitos del año solo pueden ser `19` o `20`, y el año nunca supera el actual. La interfaz lo aprovecha para advertir de intentos imposibles.
- Las flechas ↑/↓ por campo son la palanca principal de dificultad: con ellas el juego es accesible; sin ellas se parece más a Wordle puro. Son opcionales y vienen desactivadas por defecto.
- Los 6 intentos iniciales se ajustan en la Fase 4 con pruebas de juego internas. Métrica guía: que la mayoría de partidas **sin** flechas se resuelvan entre el intento 4 y el 6.
- Las estadísticas se guardan por separado con y sin flechas, para no mezclar niveles de dificultad.
- Contenido temático, fuera del MVP: "fecha histórica del día", donde la solución es un evento real y se muestra al terminar.

---

## 7. Lógica común

### 7.1 Estado (cliente)

```ts
type GameId = 'w5' | 'w6' | 'date';
type TileResult = 'correct' | 'present' | 'absent';

type GameState = {
  game: GameId;
  lang: 'es' | 'en';
  mode: 'daily' | 'practice';
  date?: string;          // reto diario
  token?: string;         // práctica
  guesses: { value: string; result: TileResult[]; hints?: FieldHints }[];
  current: string;
  status: 'playing' | 'won' | 'lost';
  hardMode: boolean;
  dateHints?: boolean;    // solo juego de fecha; se fija antes del primer intento
};
```

Claves en `localStorage`:

| Clave | Contenido |
|---|---|
| `wordkstate:w5:<lang>:daily:<date>` | Partida del día |
| `wordkstate:w6:<lang>:daily:<date>` | Partida del día |
| `wordkstate:date:daily:<date>` | Partida del día (compartida entre idiomas) |
| `wordkstate:stats:w5:<lang>` / `wordkstate:stats:w6:<lang>` | Estadísticas por juego e idioma |
| `wordkstate:stats:date:plain` / `wordkstate:stats:date:hints` | Estadísticas del juego de fecha, sin y con flechas |
| `wordkstate:prefs` | Idioma, tema, alto contraste, modo difícil, flechas de fecha |

### 7.2 Flujo

1. El jugador completa las casillas con el teclado físico o el de pantalla.
2. Al pulsar Enter se valida en local (longitud, formato de fecha, modo difícil) y se hace `POST /api/guess`.
3. Si `valid: false`: animación de sacudida + aviso ("No está en la lista" / "Fecha no válida").
4. Si es válido: animación de volteo, se actualizan el teclado (y las flechas, en fecha) y se guarda el estado.
5. Al ganar o perder se abre un modal con:
   - las estadísticas y la distribución de intentos (1–6 o 1–7);
   - la cuenta regresiva hasta el próximo reto;
   - la solución (con tildes, en español);
   - el botón **Compartir**, que copia la cuadrícula 🟩🟨⬛ al portapapeles o usa la Web Share API.

### 7.3 Algoritmo de evaluación (repeticiones)

Está en `src/lib/evaluate.ts` y lo comparten los tres juegos (letras o dígitos):

1. Primera pasada: marcar `correct` donde `guess[i] === solution[i]` y descontar ese símbolo de un contador de símbolos restantes de la solución.
2. Segunda pasada: en cada posición que no sea `correct`, si el símbolo aún tiene contador > 0 → `present` y se descuenta; si no → `absent`.

Casos de test obligatorios:

- `ABBEY / BABES`, `LLAMA / ALLAN`, letras triples, `Ñ`.
- En 6 letras: `BANANA / ANANAS`.
- En fecha: `2000-01-01 / 2001-10-10` (dígitos muy repetidos) y el 29 de febrero.

### 7.4 Teclados

- **EN (letras):** QWERTY estándar de 3 filas.
- **ES (letras):** QWERTY con `Ñ` después de `L`.
- **Fecha:** teclado numérico de 0 a 9 + borrar + enviar.
- En el teclado físico se acepta la `ñ` y las teclas con tilde se normalizan (`á → A`) con la misma función del pipeline.

---

## 8. Internacionalización y navegación

- `/` detecta el idioma (`Accept-Language` o la preferencia guardada) y redirige a `/es` o `/en`.
- `/[lang]` es el **menú de juegos**: tarjetas "Palabra de 5", "Palabra de 6" y "Fecha", cada una con su estado del día (pendiente / ganado / perdido).
- Rutas de juego (slugs traducidos mediante un mapa en i18n):

| ES | EN |
|---|---|
| `/es/5` | `/en/5` |
| `/es/6` | `/en/6` |
| `/es/fecha` | `/en/date` |
| `/es/5/practica` | `/en/5/practice` |
| `/es/creditos` | `/en/credits` |

- El selector de idioma está en el encabezado. Cambiar de idioma lleva al mismo juego en el otro idioma y **no** mezcla las partidas ni las estadísticas de los juegos de palabras.
- Los textos de la interfaz están en `src/i18n/{es,en}.json`: nombre y reglas de cada juego, mensajes de error, modal de estadísticas y textos para compartir.
- Metadatos (`<html lang>`, `title`, Open Graph) por idioma y por juego.

---

## 9. Estructura del proyecto

```
.
├── app/
│   ├── [lang]/
│   │   ├── page.tsx                 # menú de juegos
│   │   ├── [game]/page.tsx          # reto diario (5 | 6 | fecha/date)
│   │   ├── [game]/[practice]/page.tsx
│   │   └── [credits]/page.tsx
│   ├── api/
│   │   ├── guess/route.ts
│   │   ├── practice/new/route.ts
│   │   └── reveal/route.ts
│   └── layout.tsx
├── src/
│   ├── components/   # Board, Row, Tile, LetterKeyboard, NumericKeyboard, DateRow,
│   │                 # FieldHints, Modal, Toast, LangSwitcher, GameMenu
│   ├── lib/
│   │   ├── games/    # word.ts, date.ts, registry.ts
│   │   ├── evaluate.ts, normalize.ts, daily.ts, token.ts, prng.ts, storage.ts, dates.ts
│   ├── i18n/         # es.json, en.json, slugs.ts
│   └── words/        # es/{5,6}/, en/{5,6}/, es/accents.json  (JSON generados)
├── scripts/          # fetch-sources.ts, build-words.ts
├── data/             # blocklists, allowlists, REPORT.md, SOURCES.md
├── tests/            # unit (vitest) + e2e (playwright)
└── plan_init.md
```

---

## 10. Fases de trabajo

### Fase 0 — Setup (½ día)
- Crear el proyecto Next.js + TS + Tailwind + ESLint/Prettier con pnpm.
- Configurar Vitest y Playwright.
- Conectar el repo a Vercel y verificar el deploy de un "hello world" y las previews por PR.

### Fase 1 — Fuentes y pipeline de palabras (3–4 días) ⚠️ crítico
- Confirmar las licencias vigentes de cada fuente y registrarlas en `data/SOURCES.md`.
- Implementar `fetch-sources.ts` y `build-words.ts` para las longitudes 5 y 6.
- Generar las 8 listas, revisar `REPORT.md` y curar la blocklist y la allowlist.
- Escribir los tests del pipeline.
- **Criterio de salida:**
  - ≥ 1 000 `answers` y ≥ 10 000 `allowed` por idioma y longitud;
  - revisión humana de una muestra de 200 `answers` por lista, con < 2 % de palabras "raras".

### Fase 2 — Núcleo de juegos (2–3 días)
- `normalize`, `evaluate`, `daily`, `prng`, `token`, `dates` con tests unitarios.
- Módulos `games/word.ts` (5 y 6) y `games/date.ts` sobre la interfaz común.
- Route Handlers `/api/guess`, `/api/practice/new` y `/api/reveal`.

### Fase 3 — UI de palabras (2–3 días)
- Tablero parametrizable (5×6 y 6×7), casillas con animaciones, teclado en pantalla y físico, avisos.
- Modales de instrucciones, estadísticas y compartir.
- Modo oscuro, alto contraste (daltonismo: naranja/azul) y modo difícil.
- Diseño responsive, pensado primero para móvil (6 columnas deben caber en 360 px).

### Fase 4 — Juego de fecha (2 días)
- Fila de 8 casillas con separadores y orden según el idioma, teclado numérico y etiquetas "Día / Mes / Año".
- Flechas opcionales por campo, con el ajuste bloqueado tras el primer intento.
- Validación en la interfaz (fecha inexistente, anterior a 1900, futura) y mensajes de error.
- Pruebas de juego internas, con y sin flechas, para ajustar los 6 intentos iniciales (métrica en §6.3).

### Fase 5 — i18n, menú y modo práctica (1–2 días)
- Rutas `/es` y `/en` con slugs traducidos, menú de juegos, selector de idioma y textos.
- Modo práctica para los tres juegos.

### Fase 6 — Calidad y lanzamiento (1–2 días)
- E2E, para cada juego: partida ganada, partida perdida e intento no válido. Además: cambio de idioma y recarga a mitad de partida.
- Accesibilidad: `aria-live` para los resultados, navegación por teclado y contraste.
- Lighthouse ≥ 90 en rendimiento y accesibilidad.
- Página de créditos y licencias.
- **Configuración de Vercel y dominio, con acompañamiento paso a paso** (checklist en §11.1).

**Estimación total del MVP:** unos 12–16 días de trabajo.

---

## 11. Despliegue en Vercel

- Preset de framework: Next.js (se detecta solo).
- Build: `pnpm build`. Las listas ya están versionadas, así que el build no descarga nada.
- Variables de entorno: `WORD_SEED`, `GAME_SECRET` (32 bytes, base64) y `START_DATE`. Production y Preview llevan valores distintos para no filtrar los retos reales en las previews.
- Los Route Handlers corren en runtime Node. Las listas JSON (unos pocos MB en total) se cargan de forma diferida por juego e idioma y quedan en memoria entre invocaciones.
- Caché: las páginas son estáticas; `/api/*` va sin caché (`no-store`).
- Opcional: rate limiting básico en `/api/guess` con Vercel Firewall/WAF para evitar abusos.
- Dominio: subdominio gratuito de Vercel, `wordkstate.vercel.app`.

### 11.1 Checklist de configuración (Fase 6, se hará juntos)

1. **Cuenta y repo**
   - Subir el repo a GitHub (si aún no lo está).
   - En vercel.com: *Add New → Project → Import* del repositorio.
2. **Nombre del proyecto:** `wordkstate`. El subdominio `<proyecto>.vercel.app` depende de que ese nombre esté libre en Vercel. Si está tomado, alternativas: `wordkstate-game`, `wordkstate-app`.
3. **Ajustes del build**
   - Preset Next.js, instalación con `pnpm install`, build con `pnpm build`.
   - Versión de Node fijada en `package.json` (`engines`).
4. **Variables de entorno** (*Settings → Environment Variables*), con valores distintos para Production y Preview:
   - `WORD_SEED`: cadena aleatoria larga.
   - `GAME_SECRET`: 32 bytes aleatorios en base64 (se generan con `openssl rand -base64 32`).
   - `START_DATE`: fecha del reto #1 (p. ej. la de lanzamiento).
5. **Dominio** (*Settings → Domains*): confirmar que `wordkstate.vercel.app` está asignado a Production y quitar alias no deseados.
6. **Protección de previews** (*Settings → Deployment Protection*): dejar protegidas las previews para que solo el equipo las vea.
7. **Opcionales:** Vercel Analytics / Speed Insights y una regla de rate limit en Firewall para `/api/guess`.
8. **Verificación final:**
   - jugar los tres juegos en ambos idiomas desde el dominio de producción;
   - comprobar que el reto cambia a medianoche local;
   - comprobar que la solución no aparece en el código fuente ni en las respuestas de red antes de terminar la partida.

---

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Palabras demasiado raras en `answers` (sobre todo en 6 letras) | Frustración del jugador | Umbral de frecuencia por longitud + revisión humana + blocklist |
| Palabras comunes rechazadas como intento | Frustración alta | `allowed` amplio (Hunspell expandido / SCOWL alto) + allowlist + registro opcional de rechazos para curar |
| Soluciones en ES que son regionalismos | Injusto para otros países | Preferir en `answers` palabras presentes en varias variantes |
| Conjugaciones y plurales en ES como solución | Soluciones poco naturales | Usar solo raíces Hunspell para `answers` |
| Colisiones al quitar tildes | Duplicados / ambigüedad | Deduplicar tras normalizar; mostrar la forma acentuada al final |
| Juego de fecha demasiado difícil o fácil | Poca retención | Intentos configurables + flechas opcionales, ajustados con pruebas |
| Fecha solución igual al día de hoy o muy reciente | Solución "obvia" algunos días | Aceptado: la probabilidad es ≈ 1/46 000 por día; se puede excluir el último año si las pruebas lo aconsejan |
| Nombre `wordkstate` ocupado en Vercel | Subdominio distinto | Usar una alternativa (§11.1) o comprar un dominio propio más adelante |
| Confusión DD/MM vs MM/DD | Intentos erróneos | Formato por idioma, etiquetas "Día / Mes / Año" sobre las casillas y validación previa |
| Licencias incompatibles | Legal | Verificar en la Fase 1, atribuir y no redistribuir datos de frecuencia |
| Confusión con la marca Wordle (NYT) | Legal | Nombre propio "Wordkstate", diseño propio, sin logos ni textos de NYT |
| Spoilers leyendo el código o el repo | Menor | Solución en el servidor + semilla por variable de entorno + tokens cifrados |
| Zonas horarias | Reto "equivocado" | Fecha local del cliente validada a ±1 día |
| Fuentes que dejan de mantenerse (p. ej. wordfreq está congelado) | Bajo | Se descargan una vez con versión y checksum fijos; las listas generadas quedan en el repo |

---

## 13. Decisiones abiertas

Todas las decisiones de alcance del MVP están tomadas (§1.1). Quedan como mejoras futuras:

1. **Estadísticas globales** (porcentaje de aciertos del día): fuera del MVP.
2. **Dominio propio** (p. ej. `wordkstate.com`) si el proyecto crece.
3. **"Fecha histórica del día"**: soluciones ligadas a eventos reales (§6.3).
4. **Número final de intentos del juego de fecha**: se fija al terminar la Fase 4.
