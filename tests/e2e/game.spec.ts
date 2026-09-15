import { expect, test } from '@playwright/test';
import { dailyDate, dailyWord, dateKeys, guess, openGame, toast, words, wrongWords } from './helpers';

test.describe('navegación e idioma', () => {
  test('/ redirige según Accept-Language', async ({ browser }) => {
    const en = await browser.newContext({ locale: 'en-US', extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' } });
    const pageEn = await en.newPage();
    await pageEn.goto('/');
    await expect(pageEn).toHaveURL(/\/en$/);
    await en.close();

    const es = await browser.newContext({ locale: 'es-MX', extraHTTPHeaders: { 'Accept-Language': 'es-MX,es;q=0.9' } });
    const pageEs = await es.newPage();
    await pageEs.goto('/');
    await expect(pageEs).toHaveURL(/\/es$/);
    await es.close();
  });

  test('el menú lista los tres juegos y cambia de idioma', async ({ page }) => {
    await page.goto('/es');
    await expect(page.getByRole('heading', { name: 'Palabra de 5' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Palabra de 6' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fecha' })).toBeVisible();
    await page.getByRole('link', { name: /Idioma/ }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { name: '5-letter word' })).toBeVisible();
  });

  test('aplica el tema guardado y no avisa de <script> al navegar', async ({ page }) => {
    const scriptWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('script tag')) scriptWarnings.push(msg.text());
    });
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'wordkstate:prefs',
        JSON.stringify({ theme: 'dark', highContrast: true, hardMode: false, dateHints: false }),
      ),
    );
    await page.goto('/es');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
    await page.getByRole('link', { name: /Idioma/ }).click();
    await expect(page).toHaveURL(/\/en$/);
    await page.getByRole('link', { name: 'Play' }).first().click();
    await expect(page).toHaveURL(/\/en\/5$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(scriptWarnings).toEqual([]);
  });

  test('slugs traducidos: /en/fecha no existe', async ({ page }) => {
    const res = await page.goto('/en/fecha');
    expect(res?.status()).toBe(404);
  });
});

test.describe('palabra de 5 (español)', () => {
  test('rechaza palabras que no existen y gana con tildes ignoradas', async ({ page }) => {
    await openGame(page, '/es/5');
    await guess(page, 'zzzzz');
    await expect(toast(page)).toContainText('No está en la lista');

    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
    const solution = dailyWord('es', 5);
    await guess(page, solution.toLowerCase());
    await expect(page.getByRole('dialog', { name: 'Estadísticas' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('dialog')).toContainText('Racha actual');

    await page.goto('/es');
    await expect(page.getByText('Resuelto')).toBeVisible();
  });

  test('mantiene la partida al recargar', async ({ page }) => {
    await openGame(page, '/es/5');
    const [first] = wrongWords('es', 5, 1);
    await guess(page, first);
    const row = page.getByRole('group', { name: 'Intento 1' });
    await expect(row.getByRole('img').first()).toHaveAttribute('data-state', /correct|present|absent/);
    await page.reload();
    await expect(page.getByRole('group', { name: 'Intento 1' }).getByRole('img').first()).toHaveAttribute(
      'aria-label',
      new RegExp(`^${first[0]}, `),
    );
  });
});

test.describe('palabra de 6 (inglés)', () => {
  test('pierde tras 7 intentos y muestra la solución', async ({ page }) => {
    await openGame(page, '/en/6');
    for (const w of wrongWords('en', 6, 7)) {
      await guess(page, w);
      await page.waitForTimeout(2100);
    }
    const solution = dailyWord('en', 6);
    await expect(page.getByRole('dialog', { name: 'Statistics' })).toContainText(solution, { timeout: 8000 });
  });

  test('el modo difícil exige usar las pistas', async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'wordkstate:prefs',
        JSON.stringify({ theme: 'light', highContrast: false, hardMode: true, dateHints: false }),
      ),
    );
    await openGame(page, '/en/6');
    const solution = dailyWord('en', 6);
    // Un intento que comparta la primera letra con la solución deja una pista verde.
    const allowed = words('en', 6, 'allowed');
    const first = allowed.find((w) => w !== solution && w[0] === solution[0])!;
    await guess(page, first);
    await page.waitForTimeout(2200);
    const other = allowed.find((w) => w[0] !== solution[0])!;
    await guess(page, other);
    await expect(toast(page)).toContainText(`Position 1 must be ${solution[0]}`);
  });
});

test.describe('juego de fecha', () => {
  test('valida fechas y gana con flechas activadas (formato MM/DD/YYYY)', async ({ page }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'wordkstate:prefs',
        JSON.stringify({ theme: 'dark', highContrast: false, hardMode: false, dateHints: true }),
      ),
    );
    await openGame(page, '/en/date');

    await guess(page, '02302020');
    await expect(toast(page)).toContainText('does not exist');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace');

    await guess(page, '01011899');
    await expect(toast(page)).toContainText('1900 or later');
    for (let i = 0; i < 8; i++) await page.keyboard.press('Backspace');

    const solution = dailyDate();
    const wrong = solution === '1969-07-20' ? '1970-01-01' : '1969-07-20';
    await guess(page, dateKeys(wrong, 'en'));
    await page.waitForTimeout(2000);
    await expect(page.getByRole('group', { name: 'Guess 1' }).getByLabel(/^(Month|Day|Year): /)).toHaveCount(3);

    await guess(page, dateKeys(solution, 'en'));
    await expect(page.getByRole('dialog', { name: 'Statistics' })).toContainText('With arrows', { timeout: 8000 });
  });

  test('permite 10 intentos antes de perder', async ({ page }) => {
    await openGame(page, '/es/fecha');
    const solution = dailyDate();
    const wrong = Array.from({ length: 11 }, (_, i) => `19${String(10 + i * 7).padStart(2, '0')}-03-15`)
      .filter((d) => d !== solution)
      .slice(0, 10);
    const status = () =>
      page.evaluate(() => {
        const key = Object.keys(localStorage).find((k) => k.startsWith('wordkstate:date:daily:'));
        return key ? (JSON.parse(localStorage.getItem(key)!).status as string) : 'playing';
      });

    for (const [i, d] of wrong.entries()) {
      await guess(page, dateKeys(d, 'es'));
      await page.waitForTimeout(2000);
      if (i < 9) expect(await status()).toBe('playing');
    }
    expect(await status()).toBe('lost');
    await expect(page.getByRole('group', { name: 'Intento 10' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Estadísticas' })).toContainText('La solución era', { timeout: 8000 });
  });

  test('la fecha diaria es la misma en español (formato DD/MM/AAAA)', async ({ page }) => {
    await openGame(page, '/es/fecha');
    await guess(page, dateKeys(dailyDate(), 'es'));
    await expect(page.getByRole('dialog', { name: 'Estadísticas' })).toBeVisible({ timeout: 8000 });
  });
});

test.describe('práctica', () => {
  test('crea partidas nuevas sin límite', async ({ page }) => {
    await openGame(page, '/es/6/practica');
    await expect(page.getByText('Práctica', { exact: false }).first()).toBeVisible();
    const token1 = await page.evaluate(() => JSON.parse(localStorage.getItem('wordkstate:w6:es:practice')!).token);
    await page.getByRole('button', { name: 'Nueva partida' }).first().click();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('wordkstate:w6:es:practice')!).token))
      .not.toBe(token1);
  });

  test('registra estadísticas propias de práctica', async ({ page }) => {
    await openGame(page, '/en/5/practice');
    const key = 'wordkstate:w5:en:practice';
    const status = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).status as string, key);
    for (const w of words('en', 5, 'allowed').slice(100, 106)) {
      if ((await status()) !== 'playing') break;
      await guess(page, w);
      await page.waitForTimeout(2000);
    }
    const dialog = page.getByRole('dialog', { name: 'Statistics' });
    await expect(dialog).toContainText('Practice', { timeout: 8000 });
    await expect(dialog.locator('dd').first()).toHaveText('1');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wordkstate:stats:practice:w5:en')!));
    expect(stored.played).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('wordkstate:stats:w5:en'))).toBeNull();
  });

  test('un token alterado pide empezar de nuevo', async ({ page }) => {
    await openGame(page, '/en/5/practice');
    await page.evaluate(() => {
      const key = 'wordkstate:w5:en:practice';
      const saved = JSON.parse(localStorage.getItem(key)!);
      saved.token = `${saved.token.slice(0, -4)}AAAA`;
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload();
    await expect(page.getByRole('group', { name: 'Guess 1' })).toBeVisible();
    await guess(page, 'crane');
    await expect(toast(page)).toContainText('expired');
  });
});
