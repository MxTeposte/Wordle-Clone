# Wordkstate

Juegos diarios de adivinanzas inspirados en Wordle, en **español** e **inglés**:

| Juego | Casillas | Intentos | Rutas |
|---|---|---|---|
| Palabra de 5 | 5 letras | 6 | `/es/5`, `/en/5` |
| Palabra de 6 | 6 letras | 7 | `/es/6`, `/en/6` |
| Fecha oculta (1900 → hoy) | 8 dígitos | 6 | `/es/fecha` (DD/MM/AAAA), `/en/date` (MM/DD/YYYY) |

Cada juego tiene reto diario y modo práctica (`/es/5/practica`, `/en/5/practice`…). El plan completo está en [plan_init.md](plan_init.md).

## Requisitos

- Node.js 24 (ver `.nvmrc`; Vercel toma la versión de `engines` en `package.json`)
- pnpm 11

## Desarrollo

```bash
pnpm install
cp .env.example .env.local   # opcional: sin variables se usan valores de desarrollo
pnpm dev                     # http://localhost:3000
```

| Script | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm lint` · `pnpm typecheck` | ESLint · TypeScript |
| `pnpm test` | Pruebas unitarias (Vitest): lógica, API y listas de palabras |
| `pnpm test:e2e` | Pruebas E2E (Playwright, escritorio y móvil). La primera vez: `pnpm exec playwright install chromium` |
| `pnpm words:fetch` | Descarga las fuentes de palabras a `data/raw/` (con checksum) |
| `pnpm words:build` | Regenera `src/words/**` y `data/REPORT.md` |

## Cómo funciona

- **Listas de palabras** (`src/words/`): se generan en local a partir de SCOWL y del diccionario Hunspell RLA-ES, filtradas por la frecuencia de wordfreq y curadas con `data/blocklist.*.txt` / `data/allowlist.*.txt`. Fuentes y licencias en [data/SOURCES.md](data/SOURCES.md); tamaños y muestras en [data/REPORT.md](data/REPORT.md).
- **Soluciones ocultas**: los intentos se validan en Route Handlers (`app/api/*`). La solución nunca llega al navegador antes de terminar la partida. Las soluciones diarias se ordenan con `WORD_SEED`, y las partidas de práctica viajan en tokens cifrados con AES-GCM (`GAME_SECRET`).
- **Sin base de datos**: la partida en curso, las preferencias y las estadísticas se guardan en `localStorage`.

### Curar las listas

1. Añade palabras a `data/blocklist.<lang>.txt` (nunca serán solución) o a `data/allowlist.<lang>.txt` (se fuerzan como solución).
2. Ejecuta `pnpm words:fetch` (solo la primera vez) y `pnpm words:build`.
3. Ejecuta `pnpm test` y haz commit de `src/words/` y `data/REPORT.md`.

> Cambiar el contenido de una lista de soluciones reordena los retos diarios de ese idioma y longitud (también el de hoy).

## Variables de entorno

| Variable | Uso |
|---|---|
| `WORD_SEED` | Semilla secreta del orden de soluciones diarias y de la fecha del día |
| `GAME_SECRET` | Clave de cifrado de los tokens de práctica (`openssl rand -base64 32`) |
| `START_DATE` | Fecha del reto #1 (`YYYY-MM-DD`); por defecto `2026-09-15` |

Usa valores distintos en Production y Preview para que las previews no revelen los retos reales.

## Despliegue en Vercel

Ver la checklist del plan ([plan_init.md §11.1](plan_init.md)): importar el repositorio, nombre de proyecto `wordkstate` (dominio `wordkstate.vercel.app`), variables de entorno, protección de previews y verificación final.

## Licencias

El código aún no tiene una licencia definida. Las listas de palabras derivadas (`src/words/`) se publican bajo CC BY-SA 4.0 con atribución a SCOWL, RLA-ES, wordfreq y LDNOOBW (ver `/es/creditos`). Wordkstate no está afiliado a The New York Times ni a Wordle.
