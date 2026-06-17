# Архитектура системы Transit PWA

## Оглавление

1. [Концепция и принципы](#1-концепция-и-принципы)
2. [Общая схема системы](#2-общая-схема-системы)
3. [Слои приложения](#3-слои-приложения)
4. [Поток данных](#4-поток-данных)
5. [Технологический стек](#5-технологический-стек)
6. [IndexedDB — схема хранилища](#6-indexeddb--схема-хранилища)
7. [Система реалтайм (WebSocket)](#7-система-реалтайм-websocket)
8. [Merge Engine](#8-merge-engine)
9. [Рендеринг карты (deck.gl)](#9-рендеринг-карты-deckgl)
10. [Service Worker и кэширование](#10-service-worker-и-кэширование)
11. [Производительность и ограничения](#11-производительность-и-ограничения)

---

## 1. Концепция и принципы

### Offline-First

Приложение полностью функционально без сети. GTFS-данные загружаются из `feed.zip` при первом запуске и кэшируются Service Worker для офлайн-использования. При наличии сети — обновляет фид в фоне.

```
Приоритет источников данных:
1. Удалённый GTFS-фид (gtfsRemote URL)   ← свежайшие данные
2. Cache API (Service Worker)             ← последний скачанный фид
3. ./feed.zip (локальный файл)            ← резервный вариант
```

### Single-File Architecture

Всё приложение — один HTML-файл (~250 КБ). Это принципиальное архитектурное решение:

- **Развёртывание**: копирование одного файла на любой статический хостинг
- **Кэширование**: Service Worker кэширует один URL
- **Офлайн**: при добавлении на главный экран работает полностью автономно
- **Обновление**: замена одного файла на сервере обновляет всё приложение

Дополнительные файлы рядом с `index.html`:
- `splash-bg.png` — фоновое фото Камчатки на экране-заставке
- `feed.zip` — GTFS-данные (маршруты, остановки, расписание)
- `sw.js` — Service Worker

### Immutable State via Mutation

Состояние хранится в единственном мутируемом объекте `S`. Это намеренное упрощение против Redux/MobX: приложение не требует реактивности всего графа — только явные перерисовки при переходах между экранами.

---

## 2. Общая схема системы

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (PWA)                             │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  UI Layer    │    │ Domain Logic │    │   Data Layer     │  │
│  │              │    │              │    │                  │  │
│  │  deck.gl     │◄──►│  GTFS Engine │◄──►│  Memory (S.*) │  │
│  │  DOM Screens │    │  Merge Engine│    │  Cache API       │  │
│  │  Animations  │    │  Route Finder│    │  localStorage    │  │
│  └──────────────┘    └──────────────┘    └──────────────────┘  │
│           │                  ▲                      ▲           │
│           │                  │                      │           │
│           ▼                  │                      │           │
│  ┌──────────────────────┐    │           ┌──────────────────┐  │
│  │    WebSocket Client  │────┘           │  Service Worker  │  │
│  │    (WS object + sim) │                │  (Cache + Sync)  │  │
│  └──────────────────────┘                └──────────────────┘  │
│           │                                        │            │
└───────────┼────────────────────────────────────────┼────────────┘
            │                                        │
            ▼                                        ▼
┌─────────────────────┐                 ┌───────────────────────┐
│   WS Server         │                 │   CDN / Static Host   │
│   (GTFS-RT adapter) │                 │   feed.zip            │
│   ws://host:3000    │                 │   Обновления фида     │
└─────────────────────┘                 └───────────────────────┘
            │
            ▼
┌─────────────────────┐
│   AVL / GPS System  │
│   GTFS-RT protobuf  │
│   (транспорт депо)  │
└─────────────────────┘
```

---

## 3. Слои приложения

### 3.1 Data Layer

**GTFS Parser** — разбирает CSV-файлы через PapaParse в памяти:

```javascript
S.parsed = {
  routesArr:      [],   // routes.txt
  tripsArr:       [],   // trips.txt
  stopsArr:       [],   // stops.txt
  shapesArr:      [],   // shapes.txt
  stopTimesArr:   [],   // stop_times.txt  ← самый большой (~10K строк)
  vehiclesArr:    [],   // vehicles.txt (расширение)
  vehicleTripsArr:[],   // vehicle_trips.txt (расширение)
}
```

**WS Store** — реалтайм хранилище в памяти:

```javascript
const WS = {
  etaMap:      new Map(),  // `${stop_id}:${route_id}` → {etaSec, ts}
  rtVehicles:  new Map(),  // vehicle_id → {lat, lon, routeId, ts}
  stats:       {},         // метрики
}
```

**Favorites** — синхронизированы с localStorage:

```javascript
S.favRoutes  = JSON.parse(localStorage.getItem('fav-routes') || '[]')
S.favStops   = JSON.parse(localStorage.getItem('fav-stops')  || '[]')
```

### 3.2 Domain Logic

**GTFS Engine** выполняет после загрузки:

```
1. Сортировка маршрутов по номеру
2. Фильтрация остановок с валидными координатами
3. Построение Map: route_id → vehicle (из vehicle_trips.txt)
4. Вычисление позиций ТС на shape-пути (buildVehiclePositions)
5. Нормализация времён (HH:MM:SS → минуты от полуночи)
```

**Route Finder** (планировщик) — поиск пользовательского маршрута от точки до точки с пересадками:

```
1. Привязать начальную и конечную точки к ближайшим остановкам сети
2. Построить граф проездов по stop_times и пешеходных пересадок между близкими остановками
3. Выполнить поиск по графу с учётом ходьбы, ожидания и штрафа за пересадку
4. Восстановить пользовательский маршрут по сегментам: подход, поездка, пересадка, финальный проход
```

**Shape Interpolator** — позиция ТС на маршруте:

```javascript
// Предвычисленные накопленные длины отрезков
// Бинарный поиск позиции по времени анимации
// Линейная интерполяция между точками
function getVehiclePos(vp) {
  const frac = ((animTime + phaseOffset) % LOOP) / LOOP
  // бинарный поиск + lerp
}
```

### 3.3 UI Layer

**Screen Router** — CSS-based переходы:

```javascript
// Показать экран
scr.style.display = 'flex'
requestAnimationFrame(() => scr.classList.add('visible'))
// CSS: opacity + translateY transition

// Скрыть
el.classList.remove('visible')
el.style.display = 'none'
```

**Animation Loop** — requestAnimationFrame:

```javascript
(function loop(ts) {
  S.animTime += (ts - lastTs) * 0.12  // анимационное время
  deckgl.setProps({ layers: buildLayers() })
  requestAnimationFrame(loop)
})(0)
```

---

## 4. Поток данных

### Загрузка приложения

```
Открытие URL
    │
    ├─► Service Worker проверяет кэш
    │       │
    │       ├─ Кэш есть → отдаёт мгновенно (офлайн)
    │       └─ Кэша нет → загружает с сервера
    │
    ├─► Splash Screen: выбор языка
    │
    └─► loadGTFS()
            │
            ├─► Попытка fetch(gtfsRemote)   [500ms timeout]
            ├─► Попытка getCached()          [Cache API]
            └─► Попытка fetch('./feed.zip')
                    │
                    └─► PapaParse всех CSV
                            │
                            └─► buildVehiclePositions()
                                    │
                                    └─► hideLd() → renderRoutesList()
                                                 → rtStartSim()
                                                 → геолокация (navigator.geolocation)
                                                 → fallback: остановка «Краевая больница» (ПКЦ)
```

### Обновление ETA в реальном времени

```
WS событие: { type:"arrival", stop_id:"X", route_id:"Y", eta:180 }
    │
    ├─► WS.etaMap.set("X:Y", { etaSec:180, ts:Date.now() })
    ├─► WS.stats.etaCount++
    │
    └─► Если S.selStop.stop_id === "X"
            └─► rtInjectEtaIntoStopScreen("X")
                    │
                    ├─► Найти .route-block с data-route-id="Y"
                    ├─► Вставить .eta-live-row с ETA
                    └─► Добавить класс .realtime первому тайм-чипу
```

### TTL-очистка (каждые 10 секунд)

```javascript
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of WS.etaMap)
    if (now - v.ts > 45_000) WS.etaMap.delete(k)  // 45 сек TTL
}, 10_000)
```

---

## 5. Технологический стек

### Фронтенд

| Технология | Назначение | Почему выбрана |
|-----------|-----------|----------------|
| **deck.gl 8.9** | WebGL картографика | GPU-рендеринг 10K+ точек без лагов, TripsLayer для анимации |
| **CartoDB Tiles** | Подложка карты | Бесплатные тайлы, русские подписи, light + dark темы |
| **PapaParse 5.4** | CSV парсинг | Самый быстрый JS CSV-парсер, streaming режим |
| **JSZip 3.10** | Чтение feed.zip | Нативная работа с ZIP в браузере без зависимостей |
| **Nunito** (Google Fonts) | Типографика | Округлый, читабельный для широкой аудитории (14-80 лет) |
| **Vanilla JS** | Логика приложения | Нет зависимостей → меньше размер → быстрее загрузка |
| **CSS Custom Properties** | Дизайн-система | Динамическая тема, все цвета в одном месте |

### PWA-стек

| Компонент | Технология |
|-----------|-----------|
| Установка | Web App Manifest |
| Офлайн | Service Worker (Cache API) |
| Хранение данных | localStorage (favorites) + Memory (GTFS) |
| Иконки | SVG + PNG 192/512 |
| Адаптивность | viewport-fit=cover + safe-area-inset |

### Реалтайм

| Компонент | Технология |
|-----------|-----------|
| Протокол | WebSocket (нативный браузерный API) |
| Формат | JSON (newline-delimited) |
| Reconnect | setTimeout-based backoff (5 сек) |
| Heartbeat | Ping каждые 20 секунд |
| Fallback | Встроенный симулятор на реальных GTFS-данных |

---

## 6. IndexedDB — схема хранилища

> Текущая реализация использует Memory (S.parsed). Схема ниже — целевая архитектура для версии 2.0 с IndexedDB по спецификации из документации.

```
Database: gtfs_pwa_v1
```

### Stores

```
stops
  keyPath: stop_id
  indexes:
    idx_name    → stop_name
    idx_geohash → geohash      ← для поиска ближайших

routes
  keyPath: route_id
  indexes:
    idx_short_name → route_short_name

trips
  keyPath: trip_id
  indexes:
    idx_route_id → route_id
    idx_service  → service_id

stop_times_by_stop               ← ГЛАВНОЕ ХРАНИЛИЩЕ
  keyPath: [stop_id, departure_seconds]   ← compound key
  structure: {
    stop_id:          "123",
    trip_id:          "t_456",
    route_id:         "A12",     ← денормализовано (нет JOIN)
    departure_seconds: 28800,    ← секунды от полуночи (не строка)
    arrival_seconds:   28800,
    stop_sequence:    5
  }
  indexes:
    PRIMARY: [stop_id, departure_seconds]   ← O(log n) range query
    idx_trip: trip_id
    idx_route: route_id

shapes_by_route
  keyPath: route_id
  structure: {
    route_id: "A12",
    shape: [[lon, lat], ...]     ← предобработанный массив
  }

vehicles
  keyPath: vehicle_id

meta
  keyPath: key
  values: { key: "feed_version", value: "2026-03-28" }

favorites
  keyPath: id
  structure: { id: "fav_1", type: "stop"|"route", ref_id: "123" }
```

### Ключевые запросы

```javascript
// Ближайшие прибытия для остановки (O(log n))
const range = IDBKeyRange.bound(
  [stopId, nowSeconds],
  [stopId, Infinity]
)
const arrivals = await store.getAll(range, 10)

// Маршруты для остановки
const byRoute = await store.index('idx_route').getAll(routeId)

// Geohash поиск ближайших остановок
const nearby = await stopsStore.index('idx_geohash').getAll(
  IDBKeyRange.bound(geohash.substring(0,5), geohash.substring(0,5)+'~')
)
```

---

## 7. Система реалтайм (WebSocket)

### Состояния клиента

```
offline ──► connecting ──► live
   ▲              │          │
   │         (5 сек)    (ошибка)
   │              ▼          ▼
   └───────── offline ◄── error
```

### WS Client FSM

```javascript
WS = {
  state: 'offline' | 'connecting' | 'live' | 'error'
  socket: WebSocket | null
  simActive: boolean          // симулятор вкл/выкл
  etaMap: Map                 // ETA по ключу stop:route
  rtVehicles: Map             // позиции ТС
  heartbeatTimer: number      // ping каждые 20 сек
  reconnectTimer: number      // реконнект через 5 сек
}
```

### Встроенный симулятор

Работает без сервера, генерирует реалистичные события:

```
Каждые 2–5 секунд:
    1. Выбрать случайную остановку из S.allStops[0..60]
    2. Найти рейсы через неё из stopTimesArr
    3. Вычислить ETA = scheduledTime - now + jitter(±3мин)
    4. Эмитировать arrival event
    5. Взять 5 ТС из S.vehiclePositions
    6. Вычислить их текущие позиции через getVehiclePos()
    7. Эмитировать vehicle events
```

---

## 8. Merge Engine

Центральная логика объединения статики и реалтайма:

```
mergeArrivals(stopId, routeId) → [{time, etaSec, isLive}]

1. Получить static_times из S.parsed.stopTimesArr
   WHERE stop_id = stopId AND route trip_id in route trips
   ORDER BY departure_time
   FILTER departure_time >= now

2. Проверить WS.etaMap.get(`${stopId}:${routeId}`)
   IF exists AND (now - ts) < 45_000 → rtFresh = true

3. Если rtFresh:
   result[0].etaSec  = rt.etaSec
   result[0].isLive  = true
   → показать зелёную ETA строку

4. Если !rtFresh:
   → показать статические времена без изменений

5. Рендер:
   isLive = true  → .eta-live-row + .tchip.realtime
   isLive = false → стандартные .tchip
```

---

## 9. Рендеринг карты (deck.gl)

### Слои (в порядке отрисовки)

```
1. TileLayer (basemap)          ← тайлы CartoDB
2. ScatterplotLayer (stops)     ← серые точки всех остановок
3. ScatterplotLayer (stops-hi)  ← цветные точки маршрута
4. ScatterplotLayer (plan-stops)← зелёная/синяя точки планировщика
5. PathLayer (shape-glow)       ← мягкая тень маршрута (opacity 30)
6. PathLayer (shape)            ← линия маршрута
7. TripsLayer (trip-anim)       ← анимированный след
8. ScatterplotLayer (vehicles-halo) ← аура вокруг ТС
9. ScatterplotLayer (vehicles)  ← тела ТС (кликабельные)
10. ScatterplotLayer (traffic-halo) ← аура событий
11. ScatterplotLayer (traffic)  ← маркеры дорожных событий
```

### Динамические размеры (зависят от зума)

```javascript
const zr = Math.max(3, Math.min(8, S.zoom - 8))
// zoom 12 → radiusMinPixels = 4
// zoom 15 → radiusMinPixels = 7
// zoom 18 → radiusMinPixels = 10
```

### onClick routing

```javascript
deckgl.onClick = ({ object, layer }) => {
  if (layer.id === 'stops')    → openStopScreen(object.stop_id)
  if (layer.id === 'stops-hi') → openStopScreen(object.stop_id)
  if (layer.id === 'vehicles') → openVehicleCard(object.vehicle, object.routeId)
  if (layer.id === 'traffic')  → openTrafficEvent(object)
}
```

---

## 10. Service Worker и кэширование

### Стратегия кэширования

```
Запрос к ресурсу:
    │
    ├─► Тайл карты (*.png) → Cache First → Background Sync
    ├─► feed.zip            → Network First → Cache Fallback
    ├─► index.html          → Network First → Cache Fallback
    └─► Google Fonts        → Cache First (долгосрочно)
```

### Жизненный цикл SW

```
Install → Кэш shell (index.html, fonts, manifest)
Activate → Удалить старые версии кэша
Fetch → Роутинг запросов по стратегии
Message → Принять команду обновления фида
```

---

## 11. Производительность и ограничения

### Текущие показатели

| Метрика | Значение |
|---------|---------|
| First Contentful Paint | < 1.2 сек (при кэше) |
| GTFS parse (17 маршрутов) | ~80 мс |
| Рендер кадра карты (60 fps) | ~8 мс (GPU) |
| Размер HTML+данные | ~250 КБ |
| Потребление памяти | ~35 МБ |

### Известные ограничения

| Ограничение | Описание | Решение (v2) |
|------------|----------|-------------|
| Весь GTFS в памяти | stopTimesArr ~10K записей | IndexedDB + range queries |
| Нет мультиязычности | ~~Только русский интерфейс~~ **Реализовано**: RU/EN/ZH/JA | — |
| Нет push-уведомлений | Уведомления только в приложении | Web Push API |
| Один HTML-файл | Сложно обновлять по частям | Modular build (Vite) |
| Нет геохэша | Поиск ближайших O(n) | Geohash индекс в IndexedDB |

### Масштабирование до крупного города

```
При 500+ маршрутах и 50K+ остановок:
1. Переход на IndexedDB (chunked loading)
2. Lazy loading stop_times_by_stop/{id}.json по запросу
3. CDN для статических JSON-чанков
4. WebSocket с горизонтальным масштабированием через Redis pub/sub
```
