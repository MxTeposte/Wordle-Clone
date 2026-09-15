# Wordkstate — Especificaciones técnicas

Documento de referencia técnica del proyecto: tecnologías, arquitectura, rutas, APIs, lógica de juego, listas de palabras, persistencia de datos, pruebas y despliegue.

- **Estado:** commit `c7daa6c` en la rama `main` (2026-09-15).
- **Repositorio:** https://github.com/MxTeposte/Wordle-Clone
- **Plan funcional:** [plan_init.md](plan_init.md) · **Guía de uso:** [README.md](README.md)

## Autor

| | |
|---|---|
| **Nombre** | Aarón Teposte Cancio |
| **Correo** | [aaron.teposte@workstate.com](mailto:aaron.teposte@workstate.com) |
| **GitHub** | [@MxTeposte](https://github.com/MxTeposte) |

En la aplicación, estos datos aparecen en `/es/creditos` · `/en/credits` (sección "Autor") y en el pie del menú. Se definen en `src/lib/author.ts`.

---

## Índice

1. [Resumen](#1-resumen)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura](#3-arquitectura)
4. [Estructura del proyecto](#4-estructura-del-proyecto)
5. [Rutas y renderizado](#5-rutas-y-renderizado)
6. [API HTTP](#6-api-http)
7. [Lógica de juego](#7-lógica-de-juego)
8. [Listas de palabras](#8-listas-de-palabras)
9. [Persistencia: dónde se guardan los datos](#9-persistencia-dónde-se-guardan-los-datos)
10. [Frontend](#10-frontend)
11. [Configuración y variables de entorno](#11-configuración-y-variables-de-entorno)
12. [Seguridad](#12-seguridad)
13. [Pruebas y CI](#13-pruebas-y-ci)
14. [Build, despliegue y herramientas de desarrollo](#14-build-despliegue-y-herramientas-de-desarrollo)
15. [Limitaciones conocidas y pendientes](#15-limitaciones-conocidas-y-pendientes)

---

## 1. Resumen

Wordkstate es una aplicación web de juegos diarios de adivinanzas, en español e inglés:

| Juego | ID interno | Casillas | Intentos | Alfabeto |
|---|---|---|---|---|
| Palabra de 5 | `w5` | 5 | 6 | ES: A–Z + Ñ · EN: A–Z |
| Palabra de 6 | `w6` | 6 | 7 | ES: A–Z + Ñ · EN: A–Z |
| Fecha oculta (01/01/1900 → día del reto) | `date` | 8 dígitos | 10 | 0–9 |

- **Modos:** reto diario (`daily`), la misma solución para todos ese día, y práctica (`practice`), partidas aleatorias ilimitadas.
- **Principios de diseño:**
  - **Solución oculta:** se evalúa en el servidor y no llega al navegador hasta que termina la partida.
  - **Sin base de datos:** el servidor no guarda estado; la partida y las estadísticas viven en `localStorage` del navegador.
  - **Listas reproducibles:** las listas de palabras se generan con un script a partir de fuentes abiertas y se versionan en el repositorio.
  - **Compatible con Vercel:** Next.js con páginas estáticas y Route Handlers como funciones serverless.

Definición central de los juegos: [src/lib/games.ts](src/lib/games.ts).

---

## 2. Stack tecnológico

### 2.1 Runtime y framework

| Tecnología | Versión | Uso |
|---|---|---|
| **Node.js** | 24.x (`.nvmrc`, `engines`) | Runtime local, CI y Vercel |
| **pnpm** | 11.18.0 (`packageManager`) | Gestor de paquetes |
| **Next.js** | 16.3.5 (App Router, Turbopack) | Framework: páginas SSG, Route Handlers, Proxy |
| **React / React DOM** | 19.3.0 | UI |
| **TypeScript** | 5.9.3 (modo `strict`) | Lenguaje |
| **Tailwind CSS** | 4.3.3 (`@tailwindcss/postcss`) | Estilos utilitarios + variables CSS propias |
| `server-only` | 0.0.1 | Impide importar módulos de servidor desde el cliente |

### 2.2 Herramientas de desarrollo

| Tecnología | Versión | Uso |
|---|---|---|
| **Vitest** | 5.0.0 (+ Vite 8) | Pruebas unitarias |
| **Playwright** | 1.63 | Pruebas E2E (Chromium escritorio + Pixel 7) |
| **ESLint** | 9.39 + `eslint-config-next` 16.3.5 | Lint (core-web-vitals + TypeScript). ESLint 10 aún no es compatible con los plugins de Next |
| **tsx** | 4.23 | Ejecutar scripts TypeScript del pipeline de palabras |
| **fflate** | 0.8 | Descomprimir `.tar.gz`, `.oxt` y `.whl` en el pipeline |
| **@msgpack/msgpack** | 3.1 | Leer los datos de frecuencia de wordfreq |

### 2.3 APIs web de la plataforma usadas

| API | Dónde | Para qué |
|---|---|---|
| **Web Crypto** (`crypto.subtle`, `crypto.getRandomValues`) | `src/server/token.ts`, `game-service.ts` | Cifrado AES-GCM de tokens y aleatoriedad de práctica |
| **Fetch API** | Cliente (`GameScreen`) y scripts | Llamadas a `/api/*`; descarga de fuentes |
| **Web Storage** (`localStorage`) | `src/lib/storage.ts` | Partidas, estadísticas y preferencias |
| **`document.cookie`** | `Header.tsx` | Recordar el idioma elegido (`wk_lang`) |
| **Clipboard API** (`navigator.clipboard.writeText`) | Compartir | Copiar el resultado |
| **Web Share API** (`navigator.share`) | Compartir en dispositivos táctiles | Hoja nativa de compartir |
| **`<dialog>` + `showModal()`** | `Modal.tsx` | Modales accesibles (foco, Escape, fondo) |
| **`matchMedia`** | `PrefsProvider`, compartir | Tema del sistema (`prefers-color-scheme`), detectar puntero táctil |
| **`Intl.DateTimeFormat`** | `src/lib/dates.ts` | Fecha larga localizada ("20 de julio de 1969") |
| **Unicode `String.prototype.normalize`** | `src/lib/normalize.ts` | Quitar tildes (NFD) conservando la Ñ |

No se usan APIs de terceros en tiempo de ejecución: ningún servicio externo, analítica, base de datos ni autenticación.

---

## 3. Arquitectura

```
┌─────────────────────────── Navegador ───────────────────────────┐
│  Páginas estáticas (/es, /en, /es/5, /en/date…)                  │
│  ├─ InlineScript: aplica tema/contraste antes del primer pintado │
│  ├─ PrefsProvider: preferencias (localStorage)                   │
│  ├─ GameMenu: estado del día de cada juego                        │
│  └─ GameScreen: tablero, teclado, modales, estadísticas           │
│         │  POST JSON                         ▲ JSON (sin solución │
│         ▼                                    │   hasta terminar)  │
└─────────┼────────────────────────────────────┼───────────────────┘
          │                                    │
┌─────────▼──────────────── Vercel / Next.js ──┴───────────────────┐
│  proxy.ts            "/" → /es o /en (cookie o Accept-Language)   │
│  Route Handlers (Node.js, sin estado)                              │
│  ├─ POST /api/guess          → resolveGame + checkGuess            │
│  ├─ POST /api/practice/new   → createPractice (token AES-GCM)      │
│  └─ POST /api/reveal         → resolveGame + reveal                │
│  src/server/game-service.ts  (lógica)                              │
│  src/server/words.ts         (listas JSON en memoria, caché)       │
│  src/server/token.ts         (cifrado)                             │
│  src/server/config.ts        (WORD_SEED, GAME_SECRET, START_DATE)  │
└────────────────────────────────────────────────────────────────────┘

┌──────────── Pipeline local de listas (fuera del runtime) ──────────┐
│  pnpm words:fetch → data/raw/ (SCOWL, RLA-ES, wordfreq, LDNOOBW)   │
│  pnpm words:build → src/words/**.json + data/REPORT.md (versionado) │
└─────────────────────────────────────────────────────────────────────┘
```

**Separación de capas:**

| Capa | Carpeta | Se ejecuta en |
|---|---|---|
| Lógica pura (evaluación, fechas, PRNG, normalización, estadísticas, compartir, modo difícil) | `src/lib/` | Cliente, servidor, pruebas y scripts |
| Lógica de servidor (soluciones, tokens, listas, config) | `src/server/` (con `import 'server-only'`) | Solo servidor |
| UI | `src/components/`, `app/` | Cliente (componentes `'use client'`) y SSG |
| Textos | `src/i18n/` | Ambos |
| Pipeline de datos | `scripts/` | Solo local (tsx) |

---

## 4. Estructura del proyecto

```
.
├── app/                                  # App Router de Next.js
│   ├── [lang]/                           # Segmento de idioma (layout raíz)
│   │   ├── layout.tsx                    # <html lang>, metadatos, InlineScript de tema, PrefsProvider
│   │   ├── page.tsx                      # Menú de juegos
│   │   ├── not-found.tsx                 # 404 bilingüe
│   │   ├── [game]/page.tsx               # Reto diario (5 | 6 | fecha/date)
│   │   ├── [game]/practica/page.tsx      # Práctica (solo es)
│   │   ├── [game]/practice/page.tsx      # Práctica (solo en)
│   │   ├── creditos/page.tsx             # Créditos (solo es)
│   │   └── credits/page.tsx              # Créditos (solo en)
│   ├── api/guess/route.ts
│   ├── api/practice/new/route.ts
│   ├── api/reveal/route.ts
│   ├── globals.css                       # Tailwind + variables de tema + animaciones
│   └── icon.svg                          # Favicon
├── proxy.ts                              # Redirección de "/" por idioma (antes "middleware")
├── src/
│   ├── components/                       # Boards, Keyboards, GameScreen, GameMenu, Dialogs, Modal,
│   │                                     # Header, Toasts, PrefsProvider, InlineScript, Credits, Icons
│   ├── i18n/                             # es.ts, en.ts, index.ts (tipado Dictionary)
│   ├── lib/                              # types, games, evaluate, dates, normalize, prng, stats,
│   │                                     # hard-mode, share, storage
│   ├── server/                           # config, game-service, token, words, http, pages
│   └── words/                            # Listas generadas (JSON, versionadas)
│       ├── en/5/{answers,allowed}.json
│       ├── en/6/{answers,allowed}.json
│       ├── es/5/{answers,allowed}.json
│       ├── es/6/{answers,allowed}.json
│       └── es/accents.json
├── scripts/                              # fetch-sources.ts, build-words.ts, lib/{hunspell,wordfreq}.ts
├── data/                                 # SOURCES.md, REPORT.md, blocklist/allowlist/allowed-extra.*.txt
│   └── raw/                              # Fuentes descargadas (ignorado por git)
├── tests/
│   ├── unit/                             # Vitest
│   ├── e2e/                              # Playwright
│   └── stubs/server-only.ts              # Stub para importar módulos de servidor en Vitest
├── .github/workflows/ci.yml
├── .vscode/{launch,extensions}.json
├── .claude/launch.json                   # Vista previa del servidor de desarrollo (app de Claude)
└── next.config.ts · tsconfig.json · eslint.config.mjs · vitest.config.mts · playwright.config.ts
    postcss.config.mjs · pnpm-workspace.yaml · .nvmrc · .env.example
```

Alias de importación: `@/*` → `src/*` (en `tsconfig.json` y `vitest.config.mts`).

---

## 5. Rutas y renderizado

### 5.1 Páginas

| Ruta | Archivo | Renderizado | Contenido |
|---|---|---|---|
| `/` | `proxy.ts` | Proxy (redirección 307) | Redirige a `/es` o `/en` |
| `/es`, `/en` | `app/[lang]/page.tsx` | SSG | Menú de juegos con estado del día |
| `/es/5`, `/es/6`, `/es/fecha`, `/en/5`, `/en/6`, `/en/date` | `app/[lang]/[game]/page.tsx` | SSG (`dynamicParams = false`) | Reto diario |
| `/es/{5,6,fecha}/practica` | `app/[lang]/[game]/practica/page.tsx` | Dinámico bajo demanda | Práctica en español (`/en/.../practica` → 404) |
| `/en/{5,6,date}/practice` | `app/[lang]/[game]/practice/page.tsx` | Dinámico bajo demanda | Práctica en inglés (`/es/.../practice` → 404) |
| `/es/creditos`, `/en/credits` | `app/[lang]/creditos`, `credits` | SSG | Créditos y licencias |
| Cualquier otra | `app/[lang]/not-found.tsx` | — | 404 bilingüe |

- **Slugs traducidos:** los define `GAMES[id].slug`, junto con `PRACTICE_SLUG` y `CREDITS_SLUG` en [src/lib/games.ts](src/lib/games.ts). `gamePath(lang, game, practice)` construye las URL.
- **Parámetros estáticos:**
  - El layout `[lang]` genera `es` y `en`.
  - `[game]` genera los slugs de cada idioma de arriba abajo (*top-down*), con `gameStaticParams` en [src/server/pages.ts](src/server/pages.ts).
- **Tipos de rutas:** `PageProps<'/…'>` y `LayoutProps<'/…'>` se generan con `next typegen`, que forma parte de `pnpm typecheck`.

### 5.2 Selección de idioma (`proxy.ts`)

Solo actúa sobre `/` (`matcher: '/'`) y elige el idioma en este orden:

1. **Cookie `wk_lang`** (`es` | `en`). La escribe `rememberLang()` al pulsar el selector de idioma; dura 1 año, con `path=/` y `samesite=lax`.
2. **Cabecera `Accept-Language`**, ordenada por `q`; se toma el primer `es*` o `en*`.
3. **Por defecto:** `es`.

### 5.3 Metadatos

- `<html lang>` según el idioma.
- `title` con plantilla `%s · Wordkstate`, `description` por juego, `alternates.languages` (`/es`, `/en`) y Open Graph.
- `viewport.themeColor` para tema claro y oscuro.

---

## 6. API HTTP

Tres Route Handlers en runtime Node.js. Características comunes ([src/server/http.ts](src/server/http.ts)):

- **Método:** solo `POST`, con cuerpo JSON.
- **Tamaño máximo del cuerpo:** 4096 caracteres; un cuerpo mayor o mal formado se trata como `null` y devuelve `bad_request`.
- **Cabecera de respuesta:** `Cache-Control: no-store`.
- **Estado:** ninguno en el servidor. Toda la información necesaria viaja en la petición (fecha o token).
- **Errores:** `{ "error": "<código>" }` con HTTP 400.

| Código de error | Cuándo |
|---|---|
| `bad_request` | Cuerpo inválido, `game`/`lang`/`mode` desconocidos, intento no textual o de más de 32 caracteres, `reveal` no autorizado |
| `invalid_date` | Reto diario con `date` inválida, anterior a `START_DATE` o a más de ±1 día de la fecha UTC del servidor |
| `invalid_token` | Práctica con token ausente, alterado, cifrado con otro secreto o de otro juego |

### 6.1 `POST /api/guess`

Valida y evalúa un intento.

**Petición**

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `game` | `"w5" \| "w6" \| "date"` | Sí | Juego |
| `lang` | `"es" \| "en"` | Sí | Idioma |
| `mode` | `"daily" \| "practice"` | Sí | Modo |
| `date` | `"YYYY-MM-DD"` | En `daily` | Fecha local del jugador |
| `hints` | `boolean` | No (`daily`, fecha) | Si se devuelven flechas por campo |
| `token` | `string` | En `practice` | Token de la partida |
| `guess` | `string` | Sí | Palabra (se normaliza) o fecha `YYYY-MM-DD` / `YYYYMMDD` |

```json
{ "game": "w5", "lang": "es", "mode": "daily", "date": "2026-09-15", "guess": "árbol" }
{ "game": "date", "lang": "en", "mode": "daily", "date": "2026-09-15", "guess": "1969-07-20", "hints": true }
{ "game": "w6", "lang": "en", "mode": "practice", "token": "7vD7H-8UVN…", "guess": "planet" }
```

**Respuestas 200**

```json
// Intento válido
{ "valid": true, "result": ["absent","present","correct","absent","absent"], "solved": false }

// Fecha con flechas (solo si la partida las usa)
{ "valid": true, "result": ["correct","correct","present","absent","correct","absent","correct","absent"],
  "hints": { "day": "up", "month": "down", "year": "equal" }, "solved": false }

// Intento rechazado (no consume intento)
{ "valid": false, "reason": "not_in_word_list" }
```

| `reason` | Juego | Significado |
|---|---|---|
| `not_in_word_list` | Palabras | No está en `allowed` |
| `wrong_length` | Palabras | Longitud incorrecta o caracteres fuera del alfabeto |
| `incomplete` | Fecha | Formato distinto de `YYYY-MM-DD` |
| `invalid_date` | Fecha | La fecha no existe (p. ej. 31/02) |
| `before_1900` | Fecha | Anterior a 1900-01-01 |
| `future_date` | Fecha | Posterior al límite (`date` del reto o `createdOn` del token) |

- **`result`:** array con un valor por casilla (`correct` | `present` | `absent`).
- **Orden en el juego de fecha:** siempre el canónico `YYYYMMDD`, sin importar el idioma. El cliente reordena las casillas para mostrarlas.
- **`hints`:** `up` significa que el valor real es mayor, `down` que es menor y `equal` que coincide.

### 6.2 `POST /api/practice/new`

Crea una partida de práctica.

**Petición:** `{ "game": "w5", "lang": "es", "hints": false }`. `hints` solo se aplica al juego de fecha.

**Respuesta 200:** `{ "token": "<base64url>", "maxDate": "2026-09-15" }`

- **Palabras:** índice aleatorio en la lista de soluciones del idioma y la longitud.
- **Fecha:** fecha aleatoria uniforme en `[1900-01-01, hoy UTC]`.
- **Aleatoriedad:** `crypto.getRandomValues`.

### 6.3 `POST /api/reveal`

Devuelve la solución de una partida **terminada**.

**Petición:** los mismos campos de identificación que `/api/guess` más `guesses: string[]`.

**Condiciones para responder** (si no se cumplen, devuelve `bad_request`):

- `guesses.length ≤ maxAttempts`.
- Todos los intentos son válidos.
- Además, se cumple **una** de estas dos:
  - algún intento es la solución;
  - se usaron **todos** los intentos.

**Respuesta 200:**

```json
{ "solution": "ARBOL", "display": "ÁRBOL", "puzzleNumber": 17 }
{ "solution": "1969-07-20", "display": "1969-07-20" }
```

- **`display`:** en español es la forma con tildes, sacada de `accents.json`.
- **`puzzleNumber`:** solo en el reto diario.

> La comprobación de `reveal` es deliberadamente ligera: evita spoilers accidentales, no fraude. Quien envíe intentos válidos cualesquiera hasta agotar el cupo obtiene la solución.

### 6.4 Implementación

| Función (`src/server/game-service.ts`) | Responsabilidad |
|---|---|
| `resolveGame(body, now)` | Valida `game`/`lang`/`mode`, la fecha o el token, y calcula la solución, `maxDate`, `dateHints` y `puzzleNumber` |
| `checkGuess(resolved, guess)` | Normaliza, valida contra diccionario o calendario, y evalúa |
| `createPractice(body, now)` | Genera la referencia aleatoria y sella el token |
| `reveal(resolved, guesses)` | Verifica que la partida terminó y devuelve la solución |
| `isAcceptableClientDate(date, start, now)` | Regla de ±1 día respecto a UTC y fecha ≥ `START_DATE` |

---

## 7. Lógica de juego

### 7.1 Evaluación de intentos ([src/lib/evaluate.ts](src/lib/evaluate.ts))

El algoritmo es el mismo para letras y dígitos, en dos pasadas:

1. Marca `correct` donde el símbolo coincide en la misma posición. El resto de símbolos de la solución se cuentan en un mapa `símbolo → apariciones restantes`.
2. Para cada posición que no sea `correct`: si el símbolo aún tiene apariciones restantes, se marca `present` y se descuenta; si no, `absent`.

Así se resuelven correctamente las letras repetidas: `ABBEY/BABES`, `LLAMA/ALLAN`, `ANANAS/BANANA` y dígitos repetidos en fechas. Los símbolos se separan con `Array.from` para que la `Ñ` cuente como un solo carácter.

### 7.2 Normalización ([src/lib/normalize.ts](src/lib/normalize.ts))

`normalizeWord`: mayúsculas → proteger `Ñ` → NFD → eliminar marcas diacríticas (U+0300–U+036F) → restaurar `Ñ` → NFC.

- **Ejemplos:** `árbol → ARBOL`, `pingüino → PINGUINO`, `niño → NIÑO`.
- **Dónde se usa la misma función:**
  - en el pipeline de listas;
  - en la validación del servidor;
  - en el teclado físico (`normalizeKey`): pulsar `á` escribe `A`.

### 7.3 Reto diario

| Concepto | Cálculo |
|---|---|
| Fecha del reto | Fecha **local** del navegador (`todayLocal`), nunca anterior a `START_DATE` |
| Aceptación en servidor | `START_DATE ≤ date` y `|date − hoy UTC| ≤ 1 día` |
| `dayIndex` | `daysBetween(START_DATE, date)` |
| Número de reto | `dayIndex + 1` |
| Solución de palabras | `shuffle(answers, seededRng(WORD_SEED, 'answers', lang, length))[dayIndex % answers.length]` |
| Solución de fecha | `randomDate(seededRng(WORD_SEED, 'date', dayIndex), date)`, uniforme en `[1900-01-01, date]`; **igual en ambos idiomas** |
| Cambio de día | El cliente recarga la partida al volver a la pestaña (`visibilitychange`) o cuando la cuenta regresiva llega a medianoche |

**PRNG** ([src/lib/prng.ts](src/lib/prng.ts)):

- Semilla de 32 bits: hash **FNV-1a** de las partes unidas con `|`.
- Generador: **mulberry32**.
- Barajado: **Fisher–Yates** determinista.

La lista de soluciones se baraja dos veces:

- **En el pipeline**, con la semilla pública `wordkstate-v1`.
- **En el servidor**, con `WORD_SEED` secreta. El resultado se guarda en memoria por idioma, longitud y semilla. Por eso leer el repositorio no revela el orden de los retos.

### 7.4 Juego de fecha ([src/lib/dates.ts](src/lib/dates.ts))

- **Representación:**
  - canónica `YYYY-MM-DD` (API y almacenamiento);
  - dígitos `YYYYMMDD` (evaluación);
  - orden visual por idioma (`DISPLAY_ORDER`): ES `DD MM AAAA` → `[6,7,4,5,0,1,2,3]`, EN `MM DD YYYY` → `[4,5,6,7,0,1,2,3]`.
- **Validación:** gregoriana, con bisiestos 4/100/400 (`checkDateGuess`), entre 1900-01-01 y `maxDate`.
- **Validación mientras se escribe (`partialDateProblem`):** detecta antes de enviar un prefijo de año imposible (`<19` o `>20`), un año futuro, un mes mayor que 12, un día mayor que 31 y días que no existen en el mes.
- **Flechas (`dateHints`):** comparan día, mes y año por separado.
  - Son opcionales y vienen desactivadas por defecto.
  - Solo se pueden cambiar antes del primer intento; ese bloqueo se aplica en el cliente.
  - **Reto diario:** se envían en cada petición como `hints`.
  - **Práctica:** van fijadas dentro del token. Cambiarlas crea una partida nueva.
- **Formato largo:** `Intl.DateTimeFormat` con `dateStyle: 'long'` y zona UTC.

### 7.5 Modo práctica: tokens ([src/server/token.ts](src/server/token.ts))

| Aspecto | Detalle |
|---|---|
| Algoritmo | AES-GCM (cifrado autenticado), Web Crypto |
| Clave | `SHA-256(GAME_SECRET)` importada como clave AES de 256 bits (en caché por secreto) |
| IV | 12 bytes aleatorios por token |
| Formato | `base64url(IV ‖ ciphertext+tag)` |
| Payload | `{ v: 1, game, lang, ref, createdOn, dateHints }` |
| `ref` | Índice en `answers` (palabras) o fecha ISO (juego de fecha) |
| `createdOn` | Fecha UTC de creación: límite superior de fechas válidas en práctica |
| Validación | Longitud 24–1024; cualquier alteración o secreto distinto → `invalid_token` |

Rotar `GAME_SECRET` invalida las partidas de práctica en curso. El cliente muestra "La partida caducó" y crea una nueva automáticamente.

### 7.6 Modo difícil ([src/lib/hard-mode.ts](src/lib/hard-mode.ts))

Solo aplica a los juegos de palabras. Cada intento debe:

- colocar las letras verdes en su posición;
- incluir las amarillas, respetando cuántas veces aparecen.

Se valida **solo en el cliente**. Se puede activar únicamente antes del primer intento y desactivar en cualquier momento. En el texto compartido se marca con `*`.

### 7.7 Compartir ([src/lib/share.ts](src/lib/share.ts))

```
Wordkstate 5 #17 4/6*          ← juego, número de reto (o "(práctica)"), intentos, * si difícil
Wordkstate Fecha #17 7/10 ↕    ← ↕ si se jugó con flechas; X/10 si se perdió

🟩⬛🟨⬛⬛
🟩🟩🟩🟩🟩
🟩🟨 ⬛⬛ 🟩🟩🟩⬛              ← fecha: agrupado por campos en el orden visual del idioma
```

- **Colores con alto contraste:** 🟧 en lugar de 🟩 y 🟦 en lugar de 🟨.
- **Cómo se comparte:**
  - en dispositivos con puntero táctil, `navigator.share`;
  - si no está disponible o falla, se copia al portapapeles;
  - como último recurso, el texto se muestra en un aviso.

---

## 8. Listas de palabras

### 8.1 Fuentes (detalle en [data/SOURCES.md](data/SOURCES.md))

| Fuente | Versión | Uso | Licencia |
|---|---|---|---|
| SCOWL (Kevin Atkinson) | 2020.12.07 | Diccionario inglés por niveles | Permisiva estilo MIT |
| RLA-ES (Hunspell `es` general) | v2.9 | Diccionario español: raíces + afijos | GPL-3.0+/LGPL-3.0+/MPL-1.1+ (se usa MPL) |
| wordfreq (Robyn Speer) | 3.1.1, datos `large_en`/`large_es` | Frecuencia Zipf | Apache-2.0 (código), CC BY-SA 4.0 (datos) |
| LDNOOBW | commit `5faf2ba` | Filtro de términos ofensivos | CC BY 4.0 |

### 8.2 Descarga ([scripts/fetch-sources.ts](scripts/fetch-sources.ts))

- **URL y SHA-256 fijos:** si el checksum no coincide, el script falla.
- **Descarga:** Node `fetch`.
- **Extracción:**
  - un lector *ustar* propio para el `.tar.gz` de SCOWL;
  - `fflate.unzipSync` para `.oxt` (RLA-ES) y `.whl` (wordfreq).
- **Destino:** `data/raw/`, que no se versiona.

### 8.3 Generación ([scripts/build-words.ts](scripts/build-words.ts))

**Inglés**

1. Carga `english-words.NN` y `american-words.NN` de SCOWL; a cada palabra le asigna el nivel mínimo en que aparece.
2. **`allowed`:** palabras `^[a-z]+$` de nivel ≤ 80 y longitud 5 o 6.
3. **Candidatas a solución:**
   - nivel ≤ 50;
   - que no sean inflexiones regulares (heurística `isEnglishInflection`: `-s/-es/-ies`, `-ed/-ied`, `-ing`, `-est`, con consonante doblada);
   - Zipf ≥ 3.0.

**Español**

1. Expande el diccionario Hunspell con un expansor propio ([scripts/lib/hunspell.ts](scripts/lib/hunspell.ts)). Soporta:
   - `SFX`/`PFX` con condiciones y `strip`;
   - producto cruzado de prefijos y sufijos;
   - sufijos dobles mediante flags de continuación;
   - flags UTF-8, incluidos emoji con selector de variación.
2. Descarta entradas que no sean `^[a-záéíóúüñ]+$`: nombres propios, siglas, símbolos.
3. **`allowed`:** todas las formas expandidas, ya normalizadas.
4. **Candidatas a solución:** solo raíces del `.dic` (singulares, infinitivos, invariables) con Zipf ≥ 3.0.
   - Si hay variantes que se escriben igual al jugar (`papa`/`papá`), gana la más frecuente.

**Común**

- **Frecuencia:** lector de wordfreq ([scripts/lib/wordfreq.ts](scripts/lib/wordfreq.ts)): msgpack comprimido con gzip, formato `cB`, `Zipf = 9 − índice/100`.
- **Filtros:** `data/blocklist.<lang>.txt` (curada a mano) y LDNOOBW.
- **Ajustes manuales:**
  - `data/allowlist.<lang>.txt` fuerza soluciones;
  - `data/allowed-extra.<lang>.txt` añade intentos válidos que faltan en el diccionario.
- **Selección:** hasta 2 500 soluciones por lista, ordenadas por frecuencia.
- **Barajado:** con la semilla `wordkstate-v1`.
- **Integridad:** el build falla si una solución no está en `allowed`.
- **Salidas:**
  - `src/words/<lang>/<len>/answers.json` (barajado) y `allowed.json` (ordenado alfabéticamente);
  - `src/words/es/accents.json` (`"ARBOL": "árbol"`);
  - `data/REPORT.md` con tamaños, descartes por filtro, muestras y raíces a revisar.

### 8.4 Tamaños actuales

| Lista | Soluciones (`answers`) | Intentos válidos (`allowed`) | Peso aprox. (`allowed`) |
|---|---|---|---|
| en/5 | 1 621 | 11 088 | 89 KB |
| en/6 | 1 860 | 19 631 | 177 KB |
| es/5 | 1 231 | 9 124 | 73 KB |
| es/6 | 1 487 | 21 622 | 195 KB |

En total, `src/words/` ocupa unos 600 KB. El servidor carga cada lista con `import()` dinámico y la guarda en memoria: las soluciones como array barajado y `allowed` como `Set`, lo que da búsquedas O(1).

---

## 9. Persistencia: dónde se guardan los datos

### 9.1 Visión general

| Dato | Dónde | Quién lo escribe | Duración |
|---|---|---|---|
| Partida diaria en curso o terminada | `localStorage` del navegador | Cliente | 14 días (se purga) |
| Partida de práctica actual | `localStorage` | Cliente | Hasta crear otra |
| Estadísticas (diario y práctica) | `localStorage` | Cliente | Indefinida |
| Preferencias (tema, contraste, modo difícil, flechas) | `localStorage` | Cliente | Indefinida |
| "Ya vio las reglas" | `localStorage` | Cliente | Indefinida |
| Idioma elegido | Cookie `wk_lang` | Cliente | 1 año |
| Soluciones, listas y secretos | Servidor (JSON empaquetado + variables de entorno) | Build / Vercel | — |

**En el servidor no se guarda nada:** no hay base de datos, sesiones ni registros de partidas.

Consecuencias:

- Las estadísticas son **por navegador y dispositivo**: no se sincronizan entre dispositivos y se pierden si se borran los datos del sitio.
- Si `localStorage` no está disponible (modo privado, cuota llena), el juego funciona igual pero no guarda nada. Las lecturas y escrituras están envueltas en `try/catch`.

### 9.2 Claves de `localStorage` ([src/lib/storage.ts](src/lib/storage.ts))

| Clave | Contenido |
|---|---|
| `wordkstate:prefs` | `Prefs` |
| `wordkstate:seen-help` | `true` |
| `wordkstate:w5:<lang>:daily:<YYYY-MM-DD>` | `SavedGame` (reto diario, palabra de 5) |
| `wordkstate:w6:<lang>:daily:<YYYY-MM-DD>` | `SavedGame` (reto diario, palabra de 6) |
| `wordkstate:date:daily:<YYYY-MM-DD>` | `SavedGame` (reto diario de fecha; **compartido entre idiomas**) |
| `wordkstate:w5:<lang>:practice` · `wordkstate:w6:<lang>:practice` | `SavedGame` (práctica de palabras) |
| `wordkstate:date:practice` | `SavedGame` (práctica de fecha) |
| `wordkstate:stats:w5:<lang>` · `wordkstate:stats:w6:<lang>` | `Stats` del reto diario de palabras |
| `wordkstate:stats:date:plain` · `wordkstate:stats:date:hints` | `Stats` del reto diario de fecha, sin y con flechas |
| `wordkstate:stats:practice:w5:<lang>` · `wordkstate:stats:practice:w6:<lang>` | `Stats` de práctica de palabras |
| `wordkstate:stats:practice:date:plain` · `…:hints` | `Stats` de práctica de fecha |

**Purga:** al cargar un reto diario, `pruneOldGames(today)` elimina las claves `…:daily:<fecha>` con más de 14 días. Las estadísticas no se purgan.

### 9.3 Esquemas

```ts
type Prefs = {
  theme: 'system' | 'light' | 'dark';
  highContrast: boolean;
  hardMode: boolean;
  dateHints: boolean;
};

type SavedGame = {
  guesses: { value: string; result: ('correct' | 'present' | 'absent')[]; hints?: DateHints }[];
  status: 'playing' | 'won' | 'lost';
  hardMode: boolean;        // fijado al empezar (se puede desactivar)
  dateHints: boolean;       // fijado antes del primer intento
  token?: string;           // práctica
  maxDate?: string;         // límite de fechas (juego de fecha)
  solution?: string;        // forma para mostrar, recibida de /api/reveal al terminar
  puzzleNumber?: number;    // reto diario
  statsRecorded?: boolean;  // evita contar dos veces la misma partida
};

type Stats = {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[];   // distribution[i] = victorias en i+1 intentos (longitud = maxAttempts)
  lastDate?: string;        // solo reto diario
  lastWon?: boolean;
};
```

### 9.4 Reglas de estadísticas ([src/lib/stats.ts](src/lib/stats.ts))

| Regla | Reto diario (`recordResult`) | Práctica (`recordPracticeResult`) |
|---|---|---|
| Cuándo se registra | Al terminar la partida (o al recargar si quedó sin registrar) | Igual |
| Idempotencia | Por fecha (`lastDate`) y por `statsRecorded` | Por `statsRecorded` |
| Racha | Victorias en **días consecutivos**; se pierde si se salta un día (`visibleStreak`) | Victorias **consecutivas**; se reinicia con cada derrota |
| Separación | Por juego e idioma; la fecha va separada con y sin flechas | Igual, con prefijo `practice:` |

- **Cambio de intentos:** si cambia `maxAttempts` (la fecha pasó de 6 a 10), la distribución guardada se amplía conservando los valores.
- **Modal de estadísticas:** muestra las del modo actual y lo indica en el subtítulo, p. ej. "Práctica · Palabra de 5 · ES".

---

## 10. Frontend

### 10.1 Componentes principales ([src/components/](src/components))

| Componente | Responsabilidad |
|---|---|
| `GameScreen` | Controlador de partida, detallado abajo |
| `Boards` (`WordBoard`, `DateBoard`) | Tableros con tamaño de casilla calculado con CSS `min()`/`max()`/`calc()` sobre `100vw`/`100dvh`; etiquetas Día/Mes/Año y flechas |
| `Keyboards` (`LetterKeyboard`, `NumericKeyboard`, `keyStates`) | QWERTY EN, QWERTY ES con Ñ, teclado numérico compacto; estado de tecla = mejor resultado visto |
| `GameMenu` | Tarjetas de juegos con el estado del día leído de `localStorage` |
| `Dialogs` | `HelpDialog`, `StatsDialog`, `SettingsDialog`, `Countdown` hasta medianoche local |
| `Modal` | Envoltorio de `<dialog>` con `showModal()`, cierre con Escape, fondo o botón |
| `Header` | Marca, ayuda, estadísticas, ajustes y cambio de idioma (escribe la cookie) |
| `Toasts` | Avisos temporales (`role="status"`, `aria-live="polite"`) |
| `PrefsProvider` | Contexto de preferencias; aplica `data-theme` y `data-contrast` en `<html>` |
| `InlineScript` | Script en línea ejecutable solo en el HTML inicial (ver 10.3) |

**Qué hace `GameScreen`:**

- carga o crea la partida (diaria o práctica);
- gestiona la entrada por teclado físico y en pantalla;
- valida en local (longitud, modo difícil, fecha parcial) y llama a la API;
- lanza las animaciones de revelado;
- al terminar, pide la solución, registra estadísticas y abre el modal;
- permite compartir y aplica los bloqueos de ajustes.

### 10.2 Estado

- **Sin librerías de estado:** `useState`/`useCallback`/`useMemo` y un contexto (`PrefsProvider`).
- **Teclado físico:** un único listener `keydown` en `window`. Lee los manejadores más recientes desde una ref y ignora las pulsaciones con modificadores, con un modal abierto o con el foco en un input.
- **Bloqueo de entrada:** mientras hay una petición en curso (`busy`) o una fila revelándose (`revealRow`).

### 10.3 Tema y parpadeo antes de la hidratación

1. **Antes de React:** `InlineScript`, dentro de `<head>`, lee `wordkstate:prefs` y aplica `data-theme` (`light`/`dark`, resolviendo `system` con `prefers-color-scheme`) y `data-contrast="high"`. Se ejecuta durante el parseo del HTML, antes del primer pintado.
   - Es un Client Component: emite `type="text/javascript"` en el servidor y `text/plain` en el cliente, con `suppressHydrationWarning`.
   - Así React no avisa de *"Encountered a script tag…"* al volver a renderizar el layout, p. ej. al cambiar de idioma.
2. **En desarrollo:** `PrefsProvider` usa `useLayoutEffect` para reaplicar los atributos. El remontaje de Strict Mode los borra de `<html>`.
3. **Estilos:**
   - variables CSS en `:root`, `[data-theme='dark']` y `[data-contrast='high']`;
   - Tailwind con `@custom-variant dark` sobre `data-theme`.

### 10.4 Estilos y animaciones ([app/globals.css](app/globals.css))

- **Paleta por variables:**
  - generales: `--bg`, `--surface`, `--fg`, `--muted`, `--border`, `--accent`, `--key-bg`;
  - resultados: `--correct`, `--present`, `--absent`;
  - con alto contraste: naranja `#f5793a` y azul `#3d8fd6`.
- **Animaciones:**
  - `tile-flip`: giro con cambio de color a mitad, escalonado por casilla con `--delay` (280 ms en palabras, 160 ms en fecha);
  - `tile-pop` al escribir;
  - `row-shake` en un intento inválido;
  - `tile-bounce` al ganar;
  - `modal-in` al abrir un modal.
- **Movimiento reducido:** `prefers-reduced-motion: reduce` desactiva todas las animaciones.

### 10.5 Internacionalización ([src/i18n/](src/i18n))

- **Diccionarios:** objetos TypeScript. `es.ts` es la fuente del tipo `Dictionary`; `en.ts` debe cumplirlo, así que si falta una clave el build no compila.
- **Textos con parámetros:** funciones, p. ej. `description(n)`, `hardGreen(pos, letter)`, `daily(n)`.
- **Descripciones de juegos:** reciben `maxAttempts` para que coincidan siempre con `GAMES`.
- **Sin librería i18n:** el idioma lo determina el segmento de la URL.

### 10.6 Accesibilidad

- **Casillas:** `role="img"` con `aria-label` ("A, correcta").
- **Filas:** `role="group"` ("Intento 3").
- **Resultados:** tras cada intento, un anuncio en una región `aria-live` oculta visualmente.
- **Modales y ajustes:** `<dialog>` nativos con título (`aria-labelledby`); interruptores `role="switch"`; foco visible.
- **Teclas de icono:** botones con `aria-label` ("Borrar", "Estadísticas"…).

---

## 11. Configuración y variables de entorno

| Variable | Obligatoria en producción | Por defecto (desarrollo) | Uso |
|---|---|---|---|
| `WORD_SEED` | Sí | `wordkstate-dev-seed` | Orden secreto de soluciones diarias y fecha del día |
| `GAME_SECRET` | Sí | `wordkstate-dev-secret` | Clave de cifrado de tokens (`openssl rand -base64 32`) |
| `START_DATE` | Recomendada | `2026-09-15` | Fecha del reto #1; no es secreta y se usa también en el build de las páginas |

- **Aviso:** en producción, si faltan `WORD_SEED` o `GAME_SECRET`, se registra una advertencia porque las soluciones serían predecibles.
- **Plantilla:** [.env.example](.env.example). En local, `.env.local`, ignorado por git.
- **Vercel:** usar valores distintos en Production y Preview.

**Otros archivos de configuración:**

| Archivo | Contenido relevante |
|---|---|
| `next.config.ts` | `poweredByHeader: false`; cabeceras `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin` |
| `pnpm-workspace.yaml` | `allowBuilds` para `esbuild`, `unrs-resolver`, `sharp` (pnpm 11 bloquea scripts de instalación por defecto) |
| `tsconfig.json` | `strict`, `moduleResolution: bundler`, alias `@/*`, plugin de Next |
| `eslint.config.mjs` | `eslint-config-next/core-web-vitals` + `typescript` |
| `vitest.config.mts` | Alias `@` y stub de `server-only`; entorno `node` |
| `playwright.config.ts` | Proyectos `desktop` y `mobile`, `timezoneId: 'UTC'`, servidor `build + start` en el puerto 3100 con variables fijas |

---

## 12. Seguridad

| Medida | Detalle |
|---|---|
| Solución fuera del cliente | Las páginas y el JavaScript no contienen soluciones; la API solo revela al terminar |
| Orden impredecible | Barajado con `WORD_SEED` secreta; el repositorio público no permite deducir retos |
| Tokens de práctica | AES-GCM: confidencialidad (no se lee la solución) e integridad (no se alteran) |
| Fechas futuras | El servidor rechaza fechas del cliente a más de ±1 día de UTC: no se pueden pedir retos futuros |
| Entrada acotada | Cuerpo ≤ 4 KB; intento ≤ 32 caracteres; validación estricta de enumerados |
| Previews | Plan: protección de despliegues de Preview en Vercel y secretos distintos de producción |
| Sin datos personales | No hay cuentas, analítica ni almacenamiento en servidor |

**Riesgos aceptados**

- `/api/reveal` se puede usar enviando intentos válidos cualesquiera hasta agotar el cupo.
- El modo difícil y el bloqueo de flechas del reto diario se aplican solo en el cliente.
- No hay limitación de peticiones (*rate limiting*). Está planificada con Vercel Firewall.

---

## 13. Pruebas y CI

### 13.1 Pruebas unitarias (Vitest): 68 pruebas

| Archivo | Cubre |
|---|---|
| `tests/unit/evaluate.test.ts` | Letras repetidas, triples, Ñ, 6 letras, dígitos de fecha |
| `tests/unit/lib.test.ts` | Normalización, PRNG/barajado, fechas (bisiestos, rangos, validación parcial, flechas, formato), definiciones y slugs de juegos |
| `tests/unit/server.test.ts` | Tokens (alteración, secreto), tolerancia de fecha, soluciones diarias deterministas, efecto de `WORD_SEED`, validación de diccionario, `reveal`, tildes, juego de fecha, práctica |
| `tests/unit/words.test.ts` | Integridad de las 8 listas: tamaños, `answers ⊆ allowed`, longitud, alfabeto, duplicados, blocklist |
| `tests/unit/client-lib.test.ts` | Estadísticas (rachas diarias y de práctica, idempotencia, claves), modo difícil, texto para compartir |

### 13.2 Pruebas E2E (Playwright): 14 escenarios × 2 proyectos = 28

- **Navegación e idioma:**
  - redirección por `Accept-Language`;
  - menú y cambio de idioma;
  - tema guardado sin aviso de `<script>`;
  - 404 en slugs cruzados.
- **Palabra de 5 (ES):** palabra inválida, victoria con tildes ignoradas, estado "Resuelto" en el menú, conservación de la partida al recargar.
- **Palabra de 6 (EN):** derrota tras 7 intentos con la solución visible; modo difícil.
- **Fecha:**
  - validaciones: fecha inexistente, anterior a 1900;
  - flechas y victoria en MM/DD/YYYY;
  - 10 intentos antes de perder;
  - misma fecha en DD/MM/AAAA.
- **Práctica:** partidas nuevas, estadísticas propias y token alterado.

**Cómo se obtienen las soluciones:** [tests/e2e/helpers.ts](tests/e2e/helpers.ts) calcula las soluciones del día con la misma lógica que el servidor, usando las variables fijas de `playwright.config.ts`. No hay puertas traseras en la API.

### 13.3 Integración continua ([.github/workflows/ci.yml](.github/workflows/ci.yml))

- **Se ejecuta en:** cada push a `main` y cada pull request, sobre `ubuntu-latest`.
- **Pasos:**
  1. Checkout, pnpm y Node leído de `.nvmrc`, con caché de pnpm.
  2. `pnpm install --frozen-lockfile`.
  3. `pnpm lint`, `pnpm typecheck` y `pnpm test`.
  4. `playwright install --with-deps chromium` y `pnpm test:e2e`.
- **Si falla:** sube `test-results/` como artefacto, con 7 días de retención.

---

## 14. Build, despliegue y herramientas de desarrollo

### 14.1 Scripts

| Script | Acción |
|---|---|
| `pnpm dev` | Servidor de desarrollo (Turbopack) en `:3000` |
| `pnpm build` / `pnpm start` | Build de producción / servidor de producción |
| `pnpm lint` · `pnpm typecheck` | ESLint · `next typegen && tsc --noEmit` |
| `pnpm test` · `pnpm test:watch` | Vitest |
| `pnpm test:e2e` | Playwright (hace build y arranca en `:3100`) |
| `pnpm words:fetch` · `pnpm words:build` | Pipeline de listas de palabras |

### 14.2 Salida del build

- **Estáticas (SSG):** menú, retos diarios y créditos.
- **Bajo demanda:** páginas de práctica y Route Handlers.
- **Proxy:** solo sobre `/`.

### 14.3 Despliegue en Vercel (pendiente de configurar; checklist en [plan_init.md §11.1](plan_init.md))

- **Proyecto:** nombre `wordkstate`, dominio `wordkstate.vercel.app`.
- **Build:** preset Next.js; `pnpm install` / `pnpm build`; Node 24 tomado de `engines`.
- **Variables de entorno:** `WORD_SEED`, `GAME_SECRET` y `START_DATE`, con valores distintos en Production y Preview.
- **Recomendado:** protección de Preview, Vercel Analytics o Speed Insights (opcional) y regla de *rate limit* para `/api/guess`.

### 14.4 Depuración y entorno local

- **VS Code** ([.vscode/launch.json](.vscode/launch.json)):
  - servidor (`pnpm dev --inspect`);
  - cliente en Chrome;
  - full stack;
  - Vitest sobre el archivo actual;
  - `words:build` con `tsx`.
- **Extensiones recomendadas:** ESLint, Tailwind CSS IntelliSense, Vitest, Playwright.
- **App de Claude:** `.claude/launch.json` define la vista previa del servidor de desarrollo.

---

## 15. Limitaciones conocidas y pendientes

| Tema | Estado |
|---|---|
| Configuración de Vercel y dominio | Pendiente (se hará en conjunto) |
| Medición de Lighthouse (rendimiento/accesibilidad ≥ 90) | Pendiente |
| Estadísticas globales o sincronización entre dispositivos | Fuera del MVP (requeriría KV/base de datos) |
| *Rate limiting* de la API | Pendiente (Vercel Firewall) |
| Validación del modo difícil en servidor | No implementada (solo cliente) |
| Cambiar el contenido de `answers.json` | Reordena los retos diarios de esa lista, incluido el del día |
| `es/5` con 9 124 intentos válidos (< 10 000 del plan) | Aceptado: es el vocabulario real de 5 letras del diccionario |
| Licencia del código | Sin definir; las listas derivadas se publican bajo CC BY-SA 4.0 |
| ESLint 10 | Bloqueado hasta que los plugins de `eslint-config-next` lo soporten |
| "Fecha histórica del día" (eventos reales) | Idea futura |
