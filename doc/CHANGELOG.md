# Журнал изменений — Камчатка.Транспорт

> Аудит изменений React-версии (`src/`).  
> Дата: **21 июня 2026**.  
> Тесты: **153** (102 unit + 51 GTFS) — все проходят.

---

## Сводка

За период июнь 2026 в React-приложении реализованы: мультиязычные GTFS-фиды, виджет погоды (Yandex Weather, бесплатный тариф), улучшенный поиск, контекстные плашки маршрута/остановки, три режима отрисовки карты, glass-стиль UI и обновлённый Splash с флагами.

| Область | Статус | Ключевые файлы |
|---------|--------|----------------|
| GTFS i18n (ru/en/zh/ja) | ✅ | `scripts/build-gtfs-langs.mjs`, `loader.js` |
| Погода Yandex | ✅ | `src/weather/`, `WeatherWidget`, `weatherProxy.js` |
| Поиск маршрутов/остановок | ✅ | `src/utils/gtfsSearch.js`, `SearchBar.jsx` |
| Фокус маршрута | ✅ | `RouteChip`, `setActiveRoute`, `layers.js` |
| Фокус остановки | ✅ | `StopChip`, `selectStop`, `stopFocus.js` |
| Glass UI | ✅ | `index.css`, `fab.module.css`, `topPill.module.css` |
| Splash + флаги | ✅ | `Splash.jsx`, `public/flags/*.svg` |
| Иконки ТС | ✅ | `vehicleIcons.js`, `IconLayer` |

---

## 1. Мультиязычность GTFS

### Что сделано

- Языковые каталоги: `public/gtfs_en/`, `gtfs_zh/`, `gtfs_ja/` + ZIP-архивы (`gtfs_ru.zip`, `gtfs_en.zip`, `gtfs_cn.zip`, `gtfs_jp.zip`).
- Скрипт сборки: `npm run build:gtfs` → `scripts/build-gtfs-langs.mjs` (переводы из `scripts/gtfs-translations.mjs`).
- Загрузчик: `CACHE_NAME = 'gtfs-feeds-v2'`, `FEEDS` привязаны к языку интерфейса (`ru`/`en`/`zh`/`ja`).
- Тесты: `tests/unit/gtfs-i18n.test.js`.

### Worker: новые индексы

В `gtfs.worker.js` добавлены:

| Индекс | Назначение |
|--------|------------|
| `stopIdsByRouteId` | остановки на маршруте |
| `routeIdsByStopId` | маршруты через остановку |
| `arrivalsByStopId` | расписание (как раньше) |
| `routeMetaById`, `shapesByShapeId`, `firstShapeByRoute` | метаданные и геометрия |

> После обновления worker — **Ctrl+Shift+R** в браузере для сброса кэша.

---

## 2. Погода (Yandex Weather API)

### Архитектура

```
WeatherWidget → weatherSync.js → yandexWeather.js
                      ↓
              /api/weather (прокси)
                      ↓
         vite-plugins/weatherProxy.js (dev)
         scripts/weather-proxy.mjs (prod)
```

- Бесплатный тариф: REST `/v2/informers`, лимит **50 req/день**.
- Прокси кэширует ответ **1 час** (~24 запроса/сутки).
- Конфиг: `.env` → `YANDEX_WEATHER_KEY`, `VITE_WEATHER_PROXY=/api/weather`.
- Без геолокации — координаты центра ПКЧ (158.700°E, 53.015°N).
- Состояние в store: `weather`, `weatherStatus`, `weatherDisabled`.
- Тесты: `tests/unit/weather.test.js`.

---

## 3. Верхняя панель (TopBar)

Компонент `TopBar.jsx` объединяет три glass-плашки слева наверху:

| Плашка | Компонент | Поведение |
|--------|-----------|-----------|
| Погода | `WeatherWidget` | Температура, иконка; тап — скрыть/показать |
| Маршрут | `RouteChip` | Номер выбранного маршрута; ✕ → `clearRoute()` |
| Остановка | `StopChip` | Краткое имя; ✕ → `clearStopFocus()` |

Общие стили: `topPill.module.css`.

---

## 4. Режимы карты (layers.js)

Три взаимоисключающих режима отрисовки:

### Default (без фокуса)

- Все остановки при zoom ≥ 13.
- ТС не фильтруются (в текущей реализации ТС показываются только при фокусе маршрута/остановки).

### Route focus (`setActiveRoute`)

- Одна линия shape выбранного маршрута.
- Только остановки этого маршрута (zoom ≥ 11).
- Только ТС с `routeId === route.id`.
- Сбрасывает `stopFocus`.

### Stop focus (`selectStop`)

- Все линии маршрутов через остановку.
- Остановки на этих маршрутах (zoom ≥ 11).
- ТС только на этих маршрутах.
- Сбрасывает `route`.

Утилиты: `src/utils/stopFocus.js` — `getRouteIdsForStop`, `buildRoutePathEntries`, `collectStopsForRoutes`.

ТС отрисовываются через `IconLayer` + SVG (`vehicleIcons.js`).

---

## 5. Поиск

- Модуль: `src/utils/gtfsSearch.js`.
- Поиск с **1 символа** по номеру и названию маршрута, по названию остановки.
- Дедупликация противоположных направлений одного маршрута.
- Выбор маршрута: `setActiveRoute` + `flyTo` по shape.
- Выбор остановки: `selectStop` + центрирование.
- Тесты: `tests/unit/gtfs-search.test.js`.
- Legacy `public/app.html`: исправлен `filterRoutes` / `allRoutesCache`.

---

## 6. Zustand store

Новые/изменённые поля в `appStore.js`:

```javascript
stopIdsByRouteId, routeIdsByStopId,   // из worker
stopFocus: { stop, routeIds } | null,
selectStop(stop), clearStopFocus(),
setActiveRoute(routeId),  // сбрасывает stopFocus
clearRoute(),             // не сбрасывает activeStopId
weather, weatherStatus, weatherError, weatherDisabled,
```

Клик по пустой карте (`MapView`): `clearStopFocus()` + `clearRoute()`.

---

## 7. UI: glass-стиль

CSS-переменные в `src/index.css`:

- `--btn-glass`, `--glass-fg`, `--glass-border`, `--glass-shadow`

Применено к: FAB-кнопкам (`fab.module.css`), поиску (`SearchBar`), погоде, плашкам TopBar. Улучшен контраст текста в поле поиска и виджете погоды.

---

## 8. Splash

- Убрана анимированная иконка автобуса.
- Кнопки языка: SVG-флаг слева + подпись справа (grid-layout).
- Флаги: `public/flags/{ru,en,zh,ja}.svg`.
- Синхронизировано с `public/app.html`.

---

## 9. Скрипты и конфигурация

| Команда | Назначение |
|---------|------------|
| `npm run build:gtfs` | Сборка языковых GTFS ZIP |
| `npm run weather-proxy` | Продакшн-прокси погоды (:8787) |
| `npm run test:unit` | utils + weather (102 теста) |
| `npm run test:gtfs` | gtfs + i18n + search + stop-focus (51 тест) |

Файлы: `.env.example`, `vite-plugins/weatherProxy.js`, `vite.config.js` (плагин + Workbox cache для `/api/weather`).

---

## 10. Известные ограничения

| Проблема | Статус |
|----------|--------|
| E2E `splash.spec.js` — селекторы legacy `.splash-lang` | 📋 Не обновлено |
| Планировщик A→B | 🚧 Только UI-заготовка |
| Merge Engine (live ETA) | 📋 Только в legacy |
| Избранное, ДТП, карточка ТС | 🔵 Только в legacy |
| Mapbox token в коде | 📋 Техдолг |

---

## 11. Миграция документации (этот релиз)

Обновлены: `README.md`, `doc/ARCHITECTURE.md`, `doc/USER_GUIDE.md`, `doc/BACKLOG.md`, `doc/APP_DESCRIPTION.md`, `doc/README.md`, `doc/DEPLOYMENT.md`, `doc/I18N_IMPLEMENTATION.md`.