# Архитектура системы Transit PWA

> Актуально для React-версии (`src/`). Legacy single-file приложение — `public/app.html`.

## Оглавление

1. [Концепция и принципы](#1-концепция-и-принципы)
2. [Общая схема системы](#2-общая-схема-системы)
3. [Слои приложения](#3-слои-приложения)
4. [Поток данных](#4-поток-данных)
5. [Технологический стек](#5-технологический-стек)
6. [Состояние (Zustand)](#6-состояние-zustand)
7. [Система реалтайм (WebSocket)](#7-система-реалтайм-websocket)
8. [Рендеринг карты (deck.gl)](#8-рендеринг-карты-deckgl)
9. [Service Worker и кэширование](#9-service-worker-и-кэширование)
10. [Legacy-версия](#10-legacy-версия)
11. [Производительность и ограничения](#11-производительность-и-ограничения)
12. [Источники GTFS-данных](#12-источники-gtfs-данных)

---

## 1. Концепция и принципы

### Offline-First

Приложение работает без сети после первого успешного запуска. GTFS-архив скачивается по выбранному языку, кэшируется через Cache API и парсится в Web Worker. Тайлы карты предзагружаются для региона Петропавловска-Камчатского.

```
Приоритет источников GTFS:
1. Cache API (gtfs-feeds-v2)     ← последний скачанный языковой ZIP
2. Локальный / удалённый URL     ← gtfs_ru.zip / gtfs_en.zip / gtfs_cn.zip / gtfs_jp.zip
```

При наличии сети `refreshFeedsInBackground()` обновляет все языковые архивы в фоне.

### Модульная архитектура (React + Vite)

Приложение собирается Vite в папку `dist/`:

- **Развёртывание**: статический хостинг содержимого `dist/`
- **Кэширование**: Workbox (vite-plugin-pwa) кэширует JS/CSS и runtime-запросы
- **Офлайн**: PWA с autoUpdate Service Worker
- **Обновление**: `npm run build` → деплой `dist/`

### Реактивное состояние (Zustand)

Глобальное состояние — единый store `src/store/appStore.js`. Компоненты подписываются на нужные срезы через селекторы. Карта использует `storeRef` для анимационного цикла без лишних ре-рендеров.

---

## 2. Общая схема системы

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  UI Layer    │    │ Domain Logic │    │   Data Layer     │  │
│  │              │    │              │    │                  │  │
│  │  React       │◄──►│  GTFS Worker │◄──►│  Zustand store   │  │
│  │  deck.gl     │    │  Precache    │    │  Cache API       │  │
│  │  MapLibre    │    │  (planner*)  │    │  localStorage    │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│           │                  ▲                      ▲           │
│           │                  │                      │           │
│           ▼                  │                      │           │
│  ┌──────────────────────┐    │           ┌──────────────────┐  │
│  │  vehicleTracker.js   │────┘           │  Workbox SW      │  │
│  │  (WS + simulator)    │                │  (vite-plugin)   │  │
│  └──────────────────────┘                └──────────────────┘  │
│           │                                        │            │
└───────────┼────────────────────────────────────────┼────────────┘
            │                                        │
            ▼                                        ▼
┌─────────────────────┐                 ┌───────────────────────┐
│   WS Server         │                 │   CDN / Static Host   │
│   (GTFS-RT adapter) │                 │   gtfs_*.zip          │
│   ws://host:3000    │                 │   dist/ assets        │
└─────────────────────┘                 └───────────────────────┘
            │
            ▼
┌─────────────────────┐
│   AVL / GPS System  │
│   GTFS-RT protobuf  │
└─────────────────────┘

* планировщик — в разработке (UI-заготовка в store)
```

---

## 3. Слои приложения

### 3.1 Data Layer

**GTFS Loader** (`src/gtfs/loader.js`) — скачивает языковой ZIP, кэширует, передаёт буфер в Worker.

**GTFS Worker** (`src/gtfs/gtfs.worker.js`) — распаковка JSZip + парсинг PapaParse:

```javascript
// Результат после индексации (plain objects → Maps в loader.js)
{
  routes, stops,
  routeMetaById,       // route_id → { id, name, hex, shortName, routeType }
  arrivalsByStopId,    // stop_id → [{ tripId, time, mins, routeId, routeShort }]
  stopIdsByRouteId,    // route_id → [stop_id, …] (порядок по рейсу)
  routeIdsByStopId,    // stop_id → [route_id, …]
  tripToService,       // trip_id → service_id
  tripToRoute,         // trip_id → route_id
  calendarByServiceId, // service_id → calendar row
  shapesByShapeId,     // shape_id → [{ lat, lon, shape_pt_sequence }]
  firstShapeByRoute,   // route_id → shape_id
}
```

**Tile Precache** (`src/gtfs/precache.js`) — предзагрузка тайлов Mapbox для bbox Петропавловска (zoom 8–14).

**Favorites** — в React-версии пока не реализованы (есть в legacy `app.html`).

### 3.2 Domain Logic

**GTFS Worker** выполняет после парсинга:

```
1. Построение routeMetaById из routes.txt
2. Индексация arrivalsByStopId из stop_times.txt + trips.txt
3. stopIdsByRouteId и routeIdsByStopId из stop_times + trips
4. Сортировка прибытий по времени (минуты от полуночи)
5. Группировка shapes по shape_id
6. Привязка firstShapeByRoute через trips.txt
7. Индекс calendarByServiceId
```

**Утилиты фокуса** (`src/utils/stopFocus.js`):

- `getRouteIdsForStop` — маршруты через остановку (индекс + fallback по arrivals)
- `buildRoutePathEntries` — геометрия линий для stop-focus
- `collectStopsForRoutes` — остановки на наборе маршрутов

**Поиск** (`src/utils/gtfsSearch.js`): `searchRoutes`, `searchStops` — с 1 символа, дедупликация направлений.

**Route Finder** (планировщик) — **в разработке**. В store есть поля `plannerOpen`, `plannerFrom/To`, UI-кнопка `PlannerButton`. Полная логика поиска маршрута с пересадками реализована в legacy `public/app.html`.

**Merge Engine** (слияние расписания и реалтайм ETA) — **в разработке** в React-версии. В legacy реализован через `WS.etaMap`.

### 3.3 UI Layer

| Компонент | Файл | Назначение |
|-----------|------|------------|
| `App` | `src/App.jsx` | Корневой layout, загрузка GTFS, FAB-кнопки |
| `Splash` | `src/components/Splash.jsx` | Выбор языка (флаги SVG + подписи) |
| `TopBar` | `src/components/UI/TopBar.jsx` | Погода + RouteChip + StopChip |
| `MapView` | `src/components/Map/MapView.jsx` | MapLibre + deck.gl overlay |
| `Panel` | `src/components/Panel/Panel.jsx` | BottomSheet (mobile) / Sidebar (desktop) |
| `StopPopup` | `src/components/StopPopup/StopPopup.jsx` | Расписание остановки |
| UI | `src/components/UI/*` | WeatherWidget, RouteChip, StopChip, SearchBar, FAB |

Адаптивность: breakpoint 768px — мобильная нижняя панель vs десктопный сайдбар.

**Погода** (`src/weather/`): `weatherSync.js` опрашивает `/api/weather` (прокси `vite-plugins/weatherProxy.js` в dev, `scripts/weather-proxy.mjs` в prod). Кэш 1 ч, лимит API 50 req/день.

---

## 4. Поток данных

### Загрузка приложения

```
Открытие URL
    │
    ├─► Workbox SW отдаёт кэшированные ассеты (офлайн)
    │
    ├─► React mount → App.jsx
    │
    ├─► splash === true?
    │       ├─ Да  → Splash (выбор языка) → localStorage
    │       └─ Нет → сразу карта
    │
    └─► loadGtfsFeed(lang)
            │
            ├─► fetchWithCache(gtfs_{lang}.zip)
            ├─► gtfs.worker.js: unzip → parse → index
            ├─► setGtfsData() → Zustand store
            ├─► refreshFeedsInBackground() (через 3 сек)
            └─► startVehicleTracker(wsUrl) (через 1 сек)
                    │
                    ├─ wsUrl задан → WebSocket
                    └─ wsUrl null  → офлайн-симулятор
```

### Обновление позиций ТС

```
WS сообщение / симулятор
    │
    ├─► vehicleTracker.onMessage()
    ├─► Throttle 1000 мс → pendingVehicles
    └─► useAppStore.setState({ vehicles })
            │
            └─► MapView animation loop → buildLayers() → deck.gl
```

---

## 5. Технологический стек

### Фронтенд

| Технология | Версия | Назначение |
|-----------|--------|------------|
| **React** | 19 | UI-компоненты |
| **Vite** | 8 | Сборка, dev-сервер |
| **Zustand** | 5 | Глобальное состояние |
| **deck.gl** | 9 | WebGL-слои карты |
| **MapLibre GL** | 5 | Подложка (Mapbox Tiles) |
| **PapaParse** | 5 | CSV-парсинг в Worker |
| **JSZip** | 3 | Распаковка GTFS ZIP |
| **CSS Modules** | — | Стили компонентов |
| **CSS Custom Properties** | — | Дизайн-токены в `src/index.css` |

### PWA-стек

| Компонент | Технология |
|-----------|-----------|
| Установка | Web App Manifest (vite-plugin-pwa) |
| Офлайн | Workbox (autoUpdate) |
| Runtime cache | Mapbox tiles, GTFS ZIP |
| Хранение | localStorage (язык) + Cache API (фиды, тайлы) |
| Иконки | PNG 192/512 в `public/icons/` |

### Реалтайм

| Компонент | Технология |
|-----------|-----------|
| Протокол | WebSocket (нативный API) |
| Клиент | `src/realtime/vehicleTracker.js` |
| Формат | JSON (массив vehicles или отдельные события) |
| Reconnect | setTimeout 5 сек |
| Fallback | Симулятор на GTFS-маршрутах |

---

## 6. Состояние (Zustand)

Файл: `src/store/appStore.js`

```javascript
// Основные срезы состояния
{
  // Карта
  viewState, zoom, setViewState,

  // Язык
  lang, setLang,          // localStorage: kamchatka.transport.lang

  // GTFS
  allStops, allRoutes, routeMetaById, arrivalsByStopId,
  tripToService, tripToRoute, calendarByServiceId,
  shapesByShapeId, firstShapeByRoute, gtfsReady,

  // Текущий вид (взаимоисключающие режимы)
  route, shapePath, activeStopId,
  stopFocus: { stop, routeIds } | null,
  selectStop, clearStopFocus, setActiveRoute, clearRoute,
  stopIdsByRouteId, routeIdsByStopId,

  // Погода
  weather, weatherStatus, weatherDisabled,

  // Реалтайм
  vehicles, selectedVehicleId, followVehicleId,

  // Геолокация
  userLocation,

  // Поиск
  searchOpen, searchQuery,

  // Планировщик (заготовка)
  plannerOpen, plannerFrom, plannerTo, plannerResult,

  // UI
  splash, chip, popup,
}
```

Стартовые координаты: `PKC = { lon: 158.700, lat: 53.015 }`, zoom 12.5.

---

## 7. Система реалтайм (WebSocket)

### Клиент (`vehicleTracker.js`)

```
wsUrl задан?
    ├─ Да  → connect(url), reconnect через 5 сек
    │         fallback: если 10 сек без данных → симулятор
    └─ Нет → startSimulation() сразу
```

Симулятор создаёт до 30 ТС по маршрутам из store, движущихся в bbox вокруг PKC.

### Формат входящих данных

```javascript
// Поддерживаемые поля (нормализация в onMessage)
{
  vehicles: [{ id, lon, lat, bearing, route_id, label, speed, timestamp }],
  // или items: [...]
}
```

Подробнее: `doc/WEBSOCKET_API.md`.

---

## 8. Рендеринг карты (deck.gl)

Файл: `src/components/Map/layers.js`

### Режимы отрисовки

| Режим | Условие | Линии | Остановки | ТС |
|-------|---------|-------|-----------|-----|
| **default** | нет фокуса | — | все (zoom ≥ 13) | — |
| **route** | `route` + `tripsData` | один shape | на маршруте (zoom ≥ 11) | на маршруте |
| **stopFocus** | `stopFocus.routeIds` | все линии через остановку | на этих маршрутах (zoom ≥ 11) | на этих маршрутах |

`setActiveRoute` сбрасывает `stopFocus`; `selectStop` сбрасывает `route`.

### Слои (в порядке отрисовки)

```
1. PathLayer (route / stop-route)   ← линии маршрута(ов)
2. ScatterplotLayer (stops)         ← остановки (фильтр по режиму)
3. ScatterplotLayer (user)          ← геолокация (если есть)
4. ScatterplotLayer (veh-halo)      ← аура ТС
5. IconLayer (veh-icons)            ← SVG-иконки ТС (vehicleIcons.js)
6. TextLayer (veh-label)            ← номера на ТС
```

### Динамические размеры

```javascript
// dynSizes(zoom) — lineW, busR, stopR зависят от зума
const lineW = Math.max(3, Math.min(10, 2 + (z - 10) * 0.9));
```

### Подложка

MapLibre с кастомным raster-стилем Mapbox (`MapView.jsx`). Токен и URL тайлов — в `MapView.jsx` и `precache.js`.

---

## 9. Service Worker и кэширование

Конфигурация: `vite.config.js` → `VitePWA`

### Стратегии

| Ресурс | Стратегия | Cache name |
|--------|-----------|------------|
| JS/CSS/HTML (build) | precache (glob) | workbox |
| Mapbox tiles | CacheFirst | `mapbox-tiles` (6000 entries, 30 дней) |
| GTFS ZIP (`/gtfs_*.zip`) | CacheFirst | `gtfs-feeds-v2` (loader.js, 7 дней) |
| `/api/weather` | NetworkFirst / proxy cache | 1 ч (прокси) |
| Тайлы региона PKC | CacheFirst (ручной) | `transit-pwa-tiles-pk-v1` |

### Регистрация

`registerType: 'autoUpdate'` — SW обновляется автоматически при новой сборке.

---

## 10. Legacy-версия

`public/app.html` (~4000 строк) — монолитное Vanilla JS приложение:

- Полный планировщик маршрутов (Route Finder)
- Merge Engine (ETA + расписание)
- Избранные маршруты/остановки
- Тёмная/светлая тема (переключатель)
- Дорожные события, карточка ТС
- Service Worker: `public/sw.js`

Запуск без сборки:

```bash
python3 -m http.server 8000 --directory public
# → http://localhost:8000/app.html
```

Документация legacy-архитектуры (объект `S`, CartoDB tiles) описана в git-истории; текущая разработка ведётся в `src/`.

---

## 11. Производительность и ограничения

### Текущие показатели (React-версия)

| Метрика | Значение |
|---------|---------|
| GTFS parse (Worker) | ~100–300 мс |
| Chunk splitting | maplibre / deckgl / react |
| Потребление памяти | ~40–60 МБ (GTFS в памяти) |

### Статус функций

| Функция | React (`src/`) | Legacy (`app.html`) |
|---------|----------------|---------------------|
| Карта + остановки | ✅ | ✅ |
| Расписание остановок | ✅ | ✅ |
| Выбор маршрута на карте | ✅ | ✅ |
| Фокус остановки (все линии) | ✅ | 🚧 |
| Поиск маршрутов/остановок | ✅ | ✅ |
| Виджет погоды | ✅ | 🔵 |
| Языковые GTFS-фиды | ✅ | ✅ |
| Мультиязычность UI | ✅ | ✅ |
| Реалтайм / симулятор | ✅ | ✅ |
| Планировщик A→B | 🚧 UI | ✅ |
| Merge Engine (live ETA) | 🚧 | ✅ |
| Избранное | 🚧 | ✅ |
| Тёмная тема (ручная) | 🚧 auto only | ✅ |
| Дорожные события | 🚧 | ✅ |

### Известные ограничения

| Ограничение | Описание | План |
|------------|----------|------|
| GTFS в памяти | stop_times индексируется целиком | IndexedDB (v2) |
| Нет chunk GTFS | Весь ZIP парсится сразу | Lazy loading по stop_id |
| Mapbox token в коде | Публичный pk.* токен | Env variable |

---

## 12. Источники GTFS-данных

### Языковые архивы

| Язык | Файл | URL (loader.js) |
|------|------|-----------------|
| RU | `gtfs_ru.zip` | `.../public/gtfs_ru.zip` |
| EN | `gtfs_en.zip` | `.../public/gtfs_en.zip` |
| ZH | `gtfs_cn.zip` | `.../public/gtfs_cn.zip` |
| JA | `gtfs_jp.zip` | `.../public/gtfs_jp.zip` |

Базовый URL: `https://sayr777.github.io/kamchatka-transit/public` (настраивается в `src/gtfs/loader.js`).

### Исходные файлы

```
public/gtfs/
├── agency.txt, routes.txt, trips.txt, stops.txt
├── stop_times.txt, shapes.txt, calendar.txt
├── frequencies.txt, fare_*.txt
├── vehicles.txt, vehicle_trips.txt   ← расширения GTFS
└── feed_info.txt
```

### Обновление фида

```bash
# 1. Обновить .txt в public/gtfs/
# 2. Пересобрать языковые ZIP
npm run build:gtfs

# 3. Проверить
npm run validate

# 4. Собрать и задеплоить
npm run build
```

Скрипты: `scripts/build-gtfs-langs.mjs`, `scripts/gtfs-translations.mjs`, `scripts/extract-gtfs-names.mjs`.

Подробнее о расширениях: `doc/GTFS_EXTENSIONS.md`.