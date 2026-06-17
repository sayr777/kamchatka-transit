/**
 * E2E-тесты: экран-заставка (сплэш).
 * Покрывает первый запуск, выбор языка и повторное открытие.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8001';

test.beforeEach(async ({ page }) => {
  // Очищаем localStorage перед каждым тестом — симулируем первый запуск
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Первый запуск — сплэш виден', () => {
  test('сплэш показывается при отсутствии сохранённого языка', async ({ page }) => {
    const splash = page.locator('#splash');
    await expect(splash).toBeVisible({ timeout: 5000 });
  });

  test('фон заставки загружен (splash-bg.png)', async ({ page }) => {
    const bgComputed = await page.evaluate(() => {
      return getComputedStyle(document.getElementById('splash')).backgroundImage;
    });
    expect(bgComputed).toContain('splash-bg.png');
  });

  test('показывает заголовок "Камчатка.Транспорт"', async ({ page }) => {
    await expect(page.locator('.splash-title')).toContainText('Камчатка');
  });

  test('четыре кнопки выбора языка видны', async ({ page }) => {
    const langs = page.locator('.splash-lang');
    await expect(langs).toHaveCount(4);
    await expect(langs.nth(0)).toBeVisible();
    await expect(langs.nth(3)).toBeVisible();
  });

  test('кнопка "Продолжить" активна', async ({ page }) => {
    const btn = page.locator('#splash-start');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('иконка автобуса скрыта', async ({ page }) => {
    const logo = page.locator('.splash-logo');
    await expect(logo).toBeHidden();
  });
});

test.describe('Выбор языка', () => {
  test('клик по EN выделяет кнопку и сохраняет язык', async ({ page }) => {
    await page.locator('.splash-lang').filter({ hasText: 'English' }).click();

    const selected = await page.evaluate(() => window.splashSelectedLang);
    expect(selected).toBe('en');

    const hasSelected = await page.locator('.splash-lang').filter({ hasText: 'English' })
      .evaluate(el => el.classList.contains('selected'));
    expect(hasSelected).toBe(true);
  });

  test('текст кнопки "Продолжить" меняется по языку', async ({ page }) => {
    await page.locator('.splash-lang').filter({ hasText: 'English' }).click();
    await expect(page.locator('#splash-start')).toContainText('Continue');

    await page.locator('.splash-lang').filter({ hasText: 'Русский' }).click();
    await expect(page.locator('#splash-start')).toContainText('Продолжить');
  });

  test('только одна кнопка активна одновременно', async ({ page }) => {
    await page.locator('.splash-lang').filter({ hasText: 'English' }).click();
    await page.locator('.splash-lang').filter({ hasText: 'Русский' }).click();

    const selectedCount = await page.locator('.splash-lang.selected').count();
    expect(selectedCount).toBe(1);
  });
});

test.describe('Повторное открытие — сплэш пропускается', () => {
  test('если язык сохранён — сплэш скрыт сразу', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('kamchatka.transport.lang', 'ru'));
    await page.reload();

    // Ждём загрузки и проверяем что сплэш скрыт
    await page.waitForTimeout(2000);
    const splash = page.locator('#splash');
    const display = await splash.evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('кнопка 🌐 вызывает showSplash()', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('kamchatka.transport.lang', 'ru'));
    await page.reload();
    await page.waitForTimeout(3000); // ждём загрузку GTFS

    await page.evaluate(() => showSplash());

    await expect(page.locator('#splash')).toBeVisible();
    await expect(page.locator('.splash-langs')).toBeVisible();
  });
});
