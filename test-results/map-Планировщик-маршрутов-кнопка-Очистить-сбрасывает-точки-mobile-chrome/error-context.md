# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: map.spec.js >> Планировщик маршрутов >> кнопка "Очистить" сбрасывает точки
- Location: tests\e2e\map.spec.js:188:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Очистить' }).first()
    - locator resolved to <button type="button" class="planner-action" onclick="clearPlannerRoute()">Очистить</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div id="mob-sheet" class="panel-open">…</div> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div id="mob-sheet" class="panel-open">…</div> intercepts pointer events
    - retrying click action
      - waiting 100ms
    28 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div id="mob-sheet" class="panel-open">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - text: /* ── CSS СТИЛИ ──────────────────────────────────── */
  - generic [ref=e31] [cursor=pointer]:
    - img [ref=e33]
    - textbox "Маршрут или остановка…"
  - button "Где я?" [ref=e36] [cursor=pointer]:
    - img [ref=e37]
  - button "🌐" [ref=e41] [cursor=pointer]
  - button "Тема" [ref=e42] [cursor=pointer]:
    - img [ref=e43]
  - button "⇄" [active] [ref=e45] [cursor=pointer]
  - button "N" [ref=e46] [cursor=pointer]:
    - generic [ref=e48]: "N"
  - generic [ref=e49]:
    - button "Закрыть" [ref=e51] [cursor=pointer]:
      - img [ref=e52]
    - generic:
      - generic:
        - generic:
          - generic:
            - generic: Карточки
            - generic:
              - button "Предыдущий слайд": ‹
              - button "Следующий слайд": ›
          - generic:
            - generic:
              - generic:
                - article:
                  - generic:
                    - generic: "9"
                    - generic:
                      - generic: Рядом
                      - generic: Остановки и маршруты рядом
                      - generic: 4 остановок · 5 маршрутов в текущем окне карты
                  - generic:
                    - generic:
                      - generic: Остановок
                      - generic: "4"
                    - generic:
                      - generic: Маршрутов
                      - generic: "5"
                    - generic:
                      - generic: Режим
                      - generic: Остановки
                    - generic:
                      - generic: Геолокация
                      - generic: Есть
                  - generic:
                    - generic:
                      - generic:
                        - generic:
                          - generic: Хоккейная школа
                          - generic: №4 · 06:04
                        - generic: 921 м
                      - generic:
                        - generic:
                          - generic: ул. Солнечная
                          - generic: №4 · 06:06
                        - generic: 1011 м
                      - generic:
                        - generic:
                          - generic: ул. Лизы Чайкиной
                          - generic: №4 · 06:02
                        - generic: 1218 м
                      - generic:
                        - generic:
                          - generic: Развилка
                          - generic: №4 · 06:08
                        - generic: 1296 м
                  - generic:
                    - generic: №2
                    - generic: №4
                    - generic: №11
                    - generic: №11
                    - generic: №14
              - generic:
                - article:
                  - generic:
                    - generic: —
                    - generic:
                      - generic: Маршрут
                      - generic: Карточка маршрута
                      - generic: Выберите маршрут на карте или во вкладке маршрутов
                  - generic:
                    - generic: Здесь появятся длина маршрута, среднее время в пути, атрибуты из GTFS и список остановок с прогрессом прохождения.
              - generic:
                - article:
                  - generic:
                    - generic: ●
                    - generic:
                      - generic: Остановка
                      - generic: Карточка остановки
                      - generic: Кликните по остановке на карте
                  - generic:
                    - generic: Здесь появятся полное название, краткое название, маршруты через остановку и остановочное табло.
              - generic:
                - article:
                  - generic:
                    - generic: ТС
                    - generic:
                      - generic: Транспорт
                      - generic: Карточка транспортного средства
                      - generic: Выберите автобус на карте
                  - generic:
                    - generic: Здесь появятся вместимость, удобства, характеристики, доступность для инвалидов и маршрут транспортного средства.
          - generic:
            - button "Рядом"
            - button "Маршрут"
            - button "Остановка"
            - button "Транспорт"
      - generic:
        - generic:
          - generic:
            - generic:
              - generic: Маршрут по карте
              - generic: Точка на карте → общественный транспорт → точка на карте
            - generic: Маршрут по карте
          - generic:
            - button "A Откуда Нажмите на карту, чтобы выбрать точку Выберите начальную точку на карте":
              - generic: A
              - generic:
                - generic: Откуда
                - generic: Нажмите на карту, чтобы выбрать точку
                - generic: Выберите начальную точку на карте
            - button "B Куда Нажмите на карту, чтобы выбрать точку Выберите конечную точку на карте":
              - generic: B
              - generic:
                - generic: Куда
                - generic: Нажмите на карту, чтобы выбрать точку
                - generic: Выберите конечную точку на карте
          - generic:
            - button "От моей позиции"
            - button "Очистить"
            - button "Построить маршрут" [disabled]
          - generic: Нажмите на карту, чтобы выбрать точку
          - generic: Точки маршрута пока не выбраны. Можно кликать по карте или по остановкам.
      - generic:
        - button "Остановки"
        - button "Маршруты"
      - generic:
        - generic:
          - generic:
            - generic: "1"
            - generic:
              - generic: Хоккейная школа
              - generic: ~921 м · №4 · 06:04
          - generic:
            - generic: "2"
            - generic:
              - generic: ул. Солнечная
              - generic: ~1011 м · №4 · 06:06
          - generic:
            - generic: "3"
            - generic:
              - generic: ул. Лизы Чайкиной
              - generic: ~1218 м · №4 · 06:02
          - generic:
            - generic: "4"
            - generic:
              - generic: Развилка
              - generic: ~1296 м · №4 · 06:08
          - generic:
            - generic: "5"
            - generic:
              - generic: Поисково-спасательная служба
              - generic: ~1449 м · №11 · 06:06
          - generic:
            - generic: "6"
            - generic:
              - generic: ул. Степная
              - generic: ~1490 м · №4 · 06:00
          - generic:
            - generic: "7"
            - generic:
              - generic: Халактырское шоссе
              - generic: ~1648 м · №11 · 06:08
          - generic:
            - generic: "8"
            - generic:
              - generic: Школа №9
              - generic: ~1659 м · №11 · 06:04
          - generic:
            - generic: "9"
            - generic:
              - generic: Халактырский аэропорт
              - generic: ~1948 м · №11 · 06:12
          - generic:
            - generic: "10"
            - generic:
              - generic: Авторынок
              - generic: ~2215 м · №4 · 06:12
          - generic:
            - generic: "11"
            - generic:
              - generic: Халактырское кладбище
              - generic: ~2762 м · №11 · 06:10
          - generic:
            - generic: "12"
            - generic:
              - generic: Детский парк
              - generic: ~2902 м · №2 · 06:24
          - generic:
            - generic: "13"
            - generic:
              - generic: Асфальтовый завод
              - generic: ~3137 м · №11 · 06:08
          - generic:
            - generic: "14"
            - generic:
              - generic: Полуэкипаж
              - generic: ~3178 м · №2 · 06:26
```

# Test source

```ts
  94  |     }
  95  |   });
  96  | });
  97  | 
  98  | test.describe('Поиск', () => {
  99  |   test.beforeEach(async ({ page }) => {
  100 |     await loadApp(page);
  101 |     await page.waitForTimeout(1500);
  102 |   });
  103 | 
  104 |   test('клик по кнопке поиска раскрывает input', async ({ page }) => {
  105 |     const searchBar = page.locator('#search-bar');
  106 |     await searchBar.click();
  107 |     await expect(searchBar).toHaveClass(/search-open/);
  108 |     await expect(page.locator('#search-input')).toBeVisible();
  109 |   });
  110 | 
  111 |   test('ввод текста фильтрует результаты', async ({ page }) => {
  112 |     // Ждём загрузки GTFS перед поиском
  113 |     await page.waitForFunction(
  114 |       () => (S?.allStops?.length ?? 0) > 0,
  115 |       { timeout: 15000 }
  116 |     ).catch(() => {});
  117 | 
  118 |     await page.locator('#search-bar').click();
  119 |     await page.waitForTimeout(300);
  120 |     await page.locator('#search-input').fill('Площадь');
  121 |     await page.waitForTimeout(600);
  122 | 
  123 |     // Маршруты рендерятся как .route-list-item
  124 |     const results = page.locator('.route-list-item');
  125 |     const count = await results.count();
  126 |     expect(count).toBeGreaterThan(0);
  127 |   });
  128 | 
  129 |   test('escape закрывает поиск', async ({ page }) => {
  130 |     await page.locator('#search-bar').click();
  131 |     await page.waitForTimeout(300);
  132 |     await page.locator('#search-input').fill('тест');
  133 |     await page.keyboard.press('Escape');
  134 |     // Ждём анимацию закрытия
  135 |     await page.waitForTimeout(500);
  136 |     await expect(page.locator('#search-bar')).not.toHaveClass(/search-open/);
  137 |   });
  138 | });
  139 | 
  140 | test.describe('Тема', () => {
  141 |   test.beforeEach(async ({ page }) => {
  142 |     await loadApp(page);
  143 |     await page.waitForTimeout(1000);
  144 |   });
  145 | 
  146 |   test('переключение темы меняет класс html', async ({ page }) => {
  147 |     const isDarkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  148 |     await page.locator('#theme-toggle').click();
  149 |     await page.waitForTimeout(300);
  150 |     const isDarkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  151 |     expect(isDarkAfter).toBe(!isDarkBefore);
  152 |   });
  153 | 
  154 |   test('тема сохраняется в localStorage', async ({ page }) => {
  155 |     await page.locator('#theme-toggle').click();
  156 |     await page.waitForTimeout(300);
  157 |     // Проверяем все возможные ключи темы
  158 |     const saved = await page.evaluate(() => {
  159 |       return localStorage.getItem('kamchatka.transport.theme') ||
  160 |              localStorage.getItem('theme') ||
  161 |              localStorage.getItem('dark-mode');
  162 |     });
  163 |     expect(saved).toBeTruthy();
  164 |   });
  165 | });
  166 | 
  167 | test.describe('Планировщик маршрутов', () => {
  168 |   test.beforeEach(async ({ page }) => {
  169 |     await loadApp(page);
  170 |     await page.waitForTimeout(1500);
  171 |   });
  172 | 
  173 |   test('кнопка планировщика открывает панель', async ({ page }) => {
  174 |     await page.locator('#planner-btn').click();
  175 |     await page.waitForTimeout(500);
  176 |     // Панель планировщика или её содержимое стало видимым
  177 |     const panelVisible = await page.evaluate(() => {
  178 |       const p = document.getElementById('planner-panel') ||
  179 |                 document.querySelector('.planner-panel') ||
  180 |                 document.querySelector('[id*="planner"]');
  181 |       if (!p) return false;
  182 |       const style = window.getComputedStyle(p);
  183 |       return style.display !== 'none' && style.visibility !== 'hidden';
  184 |     });
  185 |     expect(panelVisible).toBe(true);
  186 |   });
  187 | 
  188 |   test('кнопка "Очистить" сбрасывает точки', async ({ page }) => {
  189 |     await page.locator('#planner-btn').click();
  190 |     await page.waitForTimeout(500);
  191 |     const clearBtn = page.getByRole('button', { name: 'Очистить' }).first();
  192 |     const visible = await clearBtn.isVisible().catch(() => false);
  193 |     if (visible) {
> 194 |       await clearBtn.click();
      |                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  195 |       const state = await page.evaluate(() => ({ from: S.plannerFrom, to: S.plannerTo }));
  196 |       expect(state.from).toBeFalsy();
  197 |       expect(state.to).toBeFalsy();
  198 |     } else {
  199 |       // Кнопка "Очистить" не видна когда нет точек — это нормально
  200 |       test.skip(true, 'Нет точек для очистки');
  201 |     }
  202 |   });
  203 | });
  204 | 
  205 | test.describe('PWA и мета-теги', () => {
  206 |   test('manifest.json доступен', async ({ page }) => {
  207 |     const resp = await page.request.get(`${BASE}/manifest.json`);
  208 |     expect(resp.status()).toBe(200);
  209 |     const json = await resp.json();
  210 |     expect(json.name).toBeTruthy();
  211 |   });
  212 | 
  213 |   test('service worker зарегистрирован', async ({ page }) => {
  214 |     await loadApp(page);
  215 |     await page.waitForTimeout(3000);
  216 |     const hasSW = await page.evaluate(async () => {
  217 |       if (!navigator.serviceWorker) return false;
  218 |       try {
  219 |         const reg = await navigator.serviceWorker.getRegistration();
  220 |         return !!reg;
  221 |       } catch {
  222 |         return false;
  223 |       }
  224 |     });
  225 |     // Service Worker не регистрируется в headless-браузере без HTTPS — пропускаем
  226 |     if (!hasSW) {
  227 |       test.skip(true, 'Service Worker не поддерживается в headless без HTTPS');
  228 |     }
  229 |     expect(hasSW).toBe(true);
  230 |   });
  231 | 
  232 |   test('viewport meta установлен', async ({ page }) => {
  233 |     await page.goto(APP);
  234 |     const viewport = await page.evaluate(() =>
  235 |       document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
  236 |     );
  237 |     expect(viewport).toContain('width=device-width');
  238 |     expect(viewport).toContain('viewport-fit=cover');
  239 |   });
  240 | 
  241 |   test('title страницы корректный', async ({ page }) => {
  242 |     await page.goto(APP);
  243 |     await expect(page).toHaveTitle(/Камчатка/);
  244 |   });
  245 | });
  246 | 
```