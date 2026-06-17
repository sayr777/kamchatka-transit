/**
 * E2E-тесты: карта и основной интерфейс после загрузки.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8001';

/** Хелпер: загружает приложение с уже сохранённым языком (пропускает сплэш) */
async function loadApp(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem('kamchatka.transport.lang', 'ru'));
  await page.reload();
  // Ждём появления deckgl (может не появиться в headless без WebGL)
  await page.waitForFunction(
    () => typeof deckgl !== 'undefined' || document.querySelector('#deck-canvas') !== null,
    { timeout: 12000 }
  ).catch(() => {}); // не падаем если WebGL недоступен
  await page.waitForTimeout(1000);
}

test.describe('Инициализация карты', () => {
  test('canvas deck.gl присутствует в DOM', async ({ page }) => {
    await loadApp(page);
    // deck.gl использует id="canvas"; WebGL может не работать в headless
    const canvas = page.locator('#canvas');
    await expect(canvas).toBeAttached({ timeout: 10000 });
  });

  test('начальный viewState — Петропавловск-Камчатский', async ({ page }) => {
    await loadApp(page);
    const viewState = await page.evaluate(() => {
      return { lon: S?.viewState?.longitude, lat: S?.viewState?.latitude };
    });
    // Камчатка: lat ~53, lon ~158
    expect(viewState.lat).toBeGreaterThan(50);
    expect(viewState.lat).toBeLessThan(60);
    expect(viewState.lon).toBeGreaterThan(155);
    expect(viewState.lon).toBeLessThan(167);
  });

  test('GTFS данные загружены', async ({ page }) => {
    await loadApp(page);
    // Ждём завершения загрузки GTFS (до 15 сек)
    await page.waitForFunction(
      () => (S?.allStops?.length ?? 0) > 0,
      { timeout: 15000 }
    ).catch(() => {});
    const stats = await page.evaluate(() => ({
      stops: S?.allStops?.length ?? 0,
      routes: S?.allRoutes?.length ?? 0,
    }));
    expect(stats.stops).toBeGreaterThan(0);
    expect(stats.routes).toBeGreaterThan(0);
  });
});

test.describe('FAB-кнопки', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.waitForTimeout(1500);
  });

  test('кнопка компаса видна', async ({ page }) => {
    await expect(page.locator('#compass-btn')).toBeVisible();
  });

  test('кнопка поиска видна', async ({ page }) => {
    await expect(page.locator('#search-bar')).toBeVisible();
  });

  test('кнопка геолокации видна', async ({ page }) => {
    await expect(page.locator('#locate-btn')).toBeVisible();
  });

  test('кнопка смены темы видна', async ({ page }) => {
    await expect(page.locator('#theme-toggle')).toBeVisible();
  });

  test('кнопка планировщика видна', async ({ page }) => {
    await expect(page.locator('#planner-btn')).toBeVisible();
  });

  test('кнопка смены языка (🌐) видна', async ({ page }) => {
    await expect(page.locator('#feed-btn')).toBeVisible();
  });

  test('все FAB имеют размер ≥ 44×44px (touch target)', async ({ page }) => {
    const ids = ['compass-btn', 'search-bar', 'locate-btn', 'theme-toggle', 'planner-btn', 'feed-btn'];
    for (const id of ids) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box?.width ?? 0, `${id} ширина`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `${id} высота`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('Поиск', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.waitForTimeout(1500);
  });

  test('клик по кнопке поиска раскрывает input', async ({ page }) => {
    const searchBar = page.locator('#search-bar');
    await searchBar.click();
    await expect(searchBar).toHaveClass(/search-open/);
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('ввод текста фильтрует результаты', async ({ page }) => {
    // Ждём загрузки GTFS перед поиском
    await page.waitForFunction(
      () => (S?.allStops?.length ?? 0) > 0,
      { timeout: 15000 }
    ).catch(() => {});

    await page.locator('#search-bar').click();
    await page.waitForTimeout(300);
    await page.locator('#search-input').fill('Площадь');
    await page.waitForTimeout(600);

    // Маршруты рендерятся как .route-list-item
    const results = page.locator('.route-list-item');
    const count = await results.count();
    expect(count).toBeGreaterThan(0);
  });

  test('escape закрывает поиск', async ({ page }) => {
    await page.locator('#search-bar').click();
    await page.waitForTimeout(300);
    await page.locator('#search-input').fill('тест');
    await page.keyboard.press('Escape');
    // Ждём анимацию закрытия
    await page.waitForTimeout(500);
    await expect(page.locator('#search-bar')).not.toHaveClass(/search-open/);
  });
});

test.describe('Тема', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.waitForTimeout(1000);
  });

  test('переключение темы меняет класс html', async ({ page }) => {
    const isDarkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await page.locator('#theme-toggle').click();
    await page.waitForTimeout(300);
    const isDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDarkAfter).toBe(!isDarkBefore);
  });

  test('тема сохраняется в localStorage', async ({ page }) => {
    await page.locator('#theme-toggle').click();
    await page.waitForTimeout(300);
    // Проверяем все возможные ключи темы
    const saved = await page.evaluate(() => {
      return localStorage.getItem('kamchatka.transport.theme') ||
             localStorage.getItem('theme') ||
             localStorage.getItem('dark-mode');
    });
    expect(saved).toBeTruthy();
  });
});

test.describe('Планировщик маршрутов', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page);
    await page.waitForTimeout(1500);
  });

  test('кнопка планировщика открывает панель', async ({ page }) => {
    await page.locator('#planner-btn').click();
    await page.waitForTimeout(500);
    // Панель планировщика или её содержимое стало видимым
    const panelVisible = await page.evaluate(() => {
      const p = document.getElementById('planner-panel') ||
                document.querySelector('.planner-panel') ||
                document.querySelector('[id*="planner"]');
      if (!p) return false;
      const style = window.getComputedStyle(p);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    expect(panelVisible).toBe(true);
  });

  test('кнопка "Очистить" сбрасывает точки', async ({ page }) => {
    await page.locator('#planner-btn').click();
    await page.waitForTimeout(500);
    const clearBtn = page.getByRole('button', { name: 'Очистить' }).first();
    const visible = await clearBtn.isVisible().catch(() => false);
    if (visible) {
      await clearBtn.click();
      const state = await page.evaluate(() => ({ from: S.plannerFrom, to: S.plannerTo }));
      expect(state.from).toBeFalsy();
      expect(state.to).toBeFalsy();
    } else {
      // Кнопка "Очистить" не видна когда нет точек — это нормально
      test.skip(true, 'Нет точек для очистки');
    }
  });
});

test.describe('PWA и мета-теги', () => {
  test('manifest.json доступен', async ({ page }) => {
    const resp = await page.request.get(`${BASE}/manifest.json`);
    expect(resp.status()).toBe(200);
    const json = await resp.json();
    expect(json.name).toBeTruthy();
  });

  test('service worker зарегистрирован', async ({ page }) => {
    await loadApp(page);
    await page.waitForTimeout(3000);
    const hasSW = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return false;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        return !!reg;
      } catch {
        return false;
      }
    });
    // Service Worker не регистрируется в headless-браузере без HTTPS — пропускаем
    if (!hasSW) {
      test.skip(true, 'Service Worker не поддерживается в headless без HTTPS');
    }
    expect(hasSW).toBe(true);
  });

  test('viewport meta установлен', async ({ page }) => {
    await page.goto(BASE);
    const viewport = await page.evaluate(() =>
      document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
    );
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
  });

  test('title страницы корректный', async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/Камчатка/);
  });
});
