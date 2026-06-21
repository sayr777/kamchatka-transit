# BACKLOG — Камчатка.Транспорт

> Миграция legacy (`public/app.html`) → React (`src/`).  
> Обновлено: **21 июня 2026**. Журнал: [`CHANGELOG.md`](CHANGELOG.md).

## Легенда

- ✅ Готово в React-версии
- 🚧 В работе / частично
- 📋 Запланировано
- 🔵 Только в legacy

---

## P0 — Критично для паритета с legacy

| Задача | Статус | Файлы |
|--------|--------|-------|
| Карта + остановки + маршруты | ✅ | `MapView.jsx`, `layers.js` |
| GTFS загрузка + Worker | ✅ | `loader.js`, `gtfs.worker.js` |
| Языковые GTFS-фиды (ru/en/zh/ja) | ✅ | `build-gtfs-langs.mjs`, `gtfs-i18n.test.js` |
| Расписание остановок | ✅ | `StopPopup.jsx` |
| Мультиязычность UI (RU/EN/ZH/JA) | ✅ | `i18n.js`, `Splash.jsx`, `flags/` |
| PWA + офлайн (Workbox) | ✅ | `vite.config.js` |
| Реалтайм симулятор | ✅ | `vehicleTracker.js` |
| Фокус маршрута (линия + остановки + ТС) | ✅ | `RouteChip`, `setActiveRoute`, `layers.js` |
| Фокус остановки (все линии через остановку) | ✅ | `StopChip`, `stopFocus.js`, `selectStop` |
| Поиск маршрутов и остановок | ✅ | `gtfsSearch.js`, `SearchBar.jsx` |
| Планировщик маршрутов A→B | 🚧 UI | `PlannerButton`, `appStore` |
| Merge Engine (live ETA) | 📋 | — |
| WebSocket UI (подключение) | 📋 | `vehicleTracker.js`, `App.jsx` |

## P1 — Важные функции

| Задача | Статус | Примечание |
|--------|--------|------------|
| Виджет погоды (Yandex, бесплатный тариф) | ✅ | `weather/`, `WeatherWidget`, `weatherProxy.js` |
| Glass-стиль FAB и TopBar | ✅ | `fab.module.css`, `topPill.module.css` |
| SVG-иконки ТС на карте | ✅ | `vehicleIcons.js`, `IconLayer` |
| Избранные маршруты/остановки | 📋 | 🔵 в legacy |
| Ручной переключатель темы | 📋 | auto `prefers-color-scheme` есть |
| Карточка ТС (удобства, заполненность) | 📋 | 🔵 в legacy |
| Дорожные события на карте | 📋 | 🔵 в legacy |
| Геокодинг в поиске | 📋 | базовый GTFS-поиск ✅ |
| E2E-тесты (актуальные селекторы Splash) | 📋 | `splash.spec.js` — legacy-классы |
| E2E-тесты планировщика | 📋 | `tests/e2e/map.spec.js` |

## P2 — Улучшения

| Задача | Статус |
|--------|--------|
| IndexedDB для stop_times | 📋 |
| Env-переменные для Mapbox token | 📋 |
| OSM+GTFS routing service | 📋 (`OSM_GTFS_ROUTING_SERVICE.md`) |
| Push-уведомления | 📋 |
| Корякский / ительменский UI | 📋 |

## P3 — Техдолг

| Задача | Статус |
|--------|--------|
| Удалить дублирование legacy/React | 📋 |
| Покрытие unit-тестами store + worker | 🚧 | search, stop-focus, weather ✅ |
| CI (build + test на push) | 📋 |
| Вынести Mapbox token из кода | 📋 |

---

## Завершённые задачи (июнь 2026)

- ✅ Миграция на React 19 + Vite 8
- ✅ Zustand store + режимы route / stopFocus
- ✅ Web Worker для GTFS + индексы `stopIdsByRouteId`, `routeIdsByStopId`
- ✅ deck.gl 9 + MapLibre 5 + IconLayer для ТС
- ✅ Адаптивный Panel (BottomSheet / Sidebar)
- ✅ i18n модуль (4 языка) + языковые GTFS ZIP
- ✅ Splash с SVG-флагами
- ✅ TopBar: погода, RouteChip, StopChip
- ✅ Поиск `gtfsSearch.js` (153 unit-теста)
- ✅ Yandex Weather прокси (dev + prod)
- ✅ Обновление README и doc/