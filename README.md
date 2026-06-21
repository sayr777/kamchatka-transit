# Камчатка.Транспорт — PWA

Офлайн-карта общественного транспорта Петропавловска-Камчатского с реалтайм-данными, GTFS-расписанием и планировщиком маршрутов.

---

## О проекте

**Камчатка.Транспорт** (Kamchatka Transit) — прогрессивное веб-приложение (PWA) для пассажиров общественного транспорта Петропавловска-Камчатского. Приложение показывает остановки, маршруты и автобусы на интерактивной карте, работает офлайн после первого запуска и устанавливается на телефон как обычное приложение.

**Слоган:** Общественный транспорт Петропавловска-Камчатского в реальном времени.

Основная версия приложения — **React + Vite** в папке `src/`. В `public/app.html` сохранена legacy single-file версия (Vanilla JS) с полным набором функций; она используется для обратной совместимости и постепенной миграции.

---

## Возможности

- Интерактивная карта с остановками и маршрутами (WebGL, deck.gl)
- **Фокус маршрута** — линия, остановки и ТС только выбранного маршрута; плашка `RouteChip` вверху
- **Фокус остановки** — все линии через остановку, связанные остановки и ТС; плашка `StopChip`
- Расписание прибытий для каждой остановки
- Поиск маршрутов и остановок с 1 символа (номер, название)
- Виджет погоды (Yandex Weather API, бесплатный тариф)
- Реалтайм-позиции автобусов по WebSocket (с симулятором при отсутствии сервера)
- Геолокация и центрирование на текущем положении
- Офлайн-режим: Service Worker кэширует приложение, GTFS-фиды и тайлы карты
- Установка на главный экран телефона (Android, iOS, ПК)
- Четыре языка интерфейса и **языковые GTFS-фиды**: русский, английский, китайский, японский
- Glass-стиль кнопок и верхней панели; адаптивный UI (BottomSheet / Sidebar)

**В разработке (React-версия):** планировщик маршрутов, live ETA, тёмная тема вручную, избранное. В legacy `public/app.html` эти функции уже реализованы.

Журнал изменений: [`doc/CHANGELOG.md`](doc/CHANGELOG.md).

---

## Технологии

| Технология | Назначение |
|------------|------------|
| **React 19** | UI-компоненты |
| **Vite 8** | Сборка и dev-сервер |
| **Zustand 5** | Глобальное состояние (`appStore`) |
| **deck.gl 9** | WebGL-слои (PathLayer, ScatterplotLayer, TextLayer) |
| **MapLibre GL 5** | Подложка карты (Mapbox Tiles) |
| **PapaParse 5** | CSV-парсинг GTFS в Web Worker |
| **JSZip 3** | Распаковка GTFS ZIP в браузере |
| **vite-plugin-pwa** | Service Worker (Workbox), манифест |
| **Vitest + Playwright** | Юнит- и E2E-тесты |
| **WebSocket** | Реалтайм-позиции транспорта |

---

## Структура проекта

```
pwa/
├── index.html                  # Точка входа Vite
├── vite.config.js              # Vite + React + PWA
├── package.json
│
├── src/                        # Основное приложение (React)
│   ├── main.jsx                # Точка входа React
│   ├── App.jsx                 # Корневой компонент
│   ├── i18n.js                 # Переводы (ru / en / zh / ja)
│   ├── index.css               # Глобальные стили
│   │
│   ├── store/
│   │   └── appStore.js         # Zustand: карта, GTFS, UI, планировщик
│   │
│   ├── gtfs/
│   │   ├── loader.js           # Загрузка и кэш языковых GTFS ZIP
│   │   ├── gtfs.worker.js      # Web Worker: распаковка + индексация
│   │   └── precache.js         # Предзагрузка тайлов Mapbox
│   │
│   ├── realtime/
│   │   └── vehicleTracker.js   # WebSocket + офлайн-симулятор
│   │
│   ├── weather/                # Yandex Weather API (прокси, кэш)
│   ├── utils/                  # gtfsSearch, stopFocus, гео-утилиты
│   │
│   └── components/
│       ├── Splash.jsx          # Выбор языка (флаги SVG)
│       ├── Map/                # MapView, layers.js, vehicleIcons.js
│       ├── Panel/              # BottomSheet / Sidebar
│       ├── StopPopup/          # Попап остановки
│       └── UI/                 # TopBar, WeatherWidget, RouteChip, StopChip, SearchBar, FAB
│
├── public/                     # Статические ассеты (копируются в dist/)
│   ├── app.html                # Legacy: монолитное приложение (Vanilla JS)
│   ├── index.html              # Лендинг «установить приложение»
│   ├── install.html
│   ├── manifest.json
│   ├── sw.js                   # Legacy Service Worker
│   ├── feed.zip                # GTFS (основной архив)
│   ├── gtfs_ru.zip             # Языковые фиды
│   ├── gtfs_en.zip
│   ├── gtfs_cn.zip
│   ├── gtfs_jp.zip
│   ├── gtfs/                   # Исходный русский GTFS .txt
│   ├── gtfs_en/, gtfs_zh/, gtfs_ja/  # Переведённые фиды
│   ├── flags/                  # SVG-флаги для Splash (ru, en, zh, ja)
│   ├── gtfs-rt/                # Пример vehicle_positions.json
│   ├── icons/                  # PWA-иконки (192, 512)
│   └── vendor/                 # Библиотеки и шрифты (для legacy)
│
├── dist/                       # Результат `npm run build`
│
├── doc/                        # Документация (индекс: doc/README.md)
│   ├── ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   ├── USER_GUIDE.md
│   ├── BRANDBOOK.md
│   ├── GTFS_EXTENSIONS.md
│   ├── WEBSOCKET_API.md
│   └── I18N_IMPLEMENTATION.md
│
├── scripts/
│   ├── validate-feed.py        # Проверка GTFS-фида
│   ├── build-gtfs-langs.mjs    # Сборка языковых ZIP (npm run build:gtfs)
│   ├── gtfs-translations.mjs   # Словарь переводов остановок/маршрутов
│   └── weather-proxy.mjs       # Продакшн-прокси погоды
│
├── vite-plugins/
│   └── weatherProxy.js         # Dev-прокси /api/weather
│
└── tests/
    ├── unit/                   # Vitest
    └── e2e/                    # Playwright
```

---

## Быстрый старт

### Требования

- Node.js 18+
- npm

### Установка и запуск

```bash
npm install
npm run dev
```

Откройте в браузере: **http://localhost:5173**

Для доступа с телефона в той же Wi-Fi сети:

```bash
npm run dev -- --host
# Затем откройте http://<IP-вашего-компьютера>:5173
```

### Сборка и превью

```bash
npm run build      # → dist/
npm run preview    # локальный просмотр production-сборки
```

### Тесты

```bash
npm run test           # 153 теста: utils + weather + gtfs + search + stop-focus
npm run test:unit      # utils + weather (102)
npm run test:gtfs      # gtfs + i18n + search + stop-focus (51)
npm run test:e2e       # Playwright E2E
npm run test:all       # всё вместе
npm run build:gtfs     # пересборка языковых GTFS ZIP
npm run validate       # python scripts/validate-feed.py public/gtfs
```

### Legacy-версия (без сборки)

Для запуска монолитного `public/app.html` без Node.js:

```bash
python3 -m http.server 8000 --directory public
# → http://localhost:8000/app.html
```

---

## Данные GTFS

Исходные `.txt` — в `public/gtfs/` (русский). Переводы — в `public/gtfs_en/`, `gtfs_zh/`, `gtfs_ja/`. Языковые архивы (`gtfs_ru.zip`, `gtfs_en.zip`, `gtfs_cn.zip`, `gtfs_jp.zip`) загружаются по выбранному языку интерфейса.

Пересборка ZIP после правок переводов:

```bash
npm run build:gtfs
```

Загрузчик: `src/gtfs/loader.js` — Cache API `gtfs-feeds-v2`, парсинг в Web Worker с индексами `stopIdsByRouteId` и `routeIdsByStopId`.

Проверка фида:

```bash
npm run validate
# или
python scripts/validate-feed.py public/gtfs
```

Используемые расширения GTFS: `vehicles.txt`, `vehicle_trips.txt`. Подробнее: `doc/GTFS_EXTENSIONS.md`.

---

## Развёртывание

Для продакшна соберите проект и разверните содержимое `dist/`:

```bash
npm run build
scp -r dist/* user@SERVER:/var/www/transit-pwa/
```

**Минимальные требования:**

- Статический хостинг с HTTPS (обязателен для PWA)
- Для реалтайм-данных — опциональный WebSocket-сервер

**Пример с Nginx:**

```nginx
server {
    listen 80;
    server_name transit.ваш-домен.ru;
    root /var/www/transit-pwa;
    index index.html;

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    location / { try_files $uri /index.html; }
}
```

Полная инструкция: `doc/DEPLOYMENT.md`.

---

## Настройка

| Что | Где |
|-----|-----|
| URL языковых GTFS-фидов | `src/gtfs/loader.js` → `FEEDS`, `BASE` |
| WebSocket-сервер | `src/App.jsx` → `startVehicleTracker(wsUrl)` |
| Стартовые координаты карты | `src/store/appStore.js` → `PKC`, `viewState` |
| Токен и стиль Mapbox | `src/components/Map/MapView.jsx`, `src/gtfs/precache.js` |
| PWA-манифест | `vite.config.js` → `VitePWA.manifest` |
| Переводы интерфейса | `src/i18n.js` |
| Yandex Weather API | `.env` → `YANDEX_WEATHER_KEY` + `VITE_WEATHER_PROXY=/api/weather` |

### Погода (Yandex — бесплатный тариф)

1. Получите ключ: [developer.tech.yandex.ru](https://developer.tech.yandex.ru/) → сервис **«Погода»** (тариф «На вашем сайте», 50 req/день)
2. Скопируйте `.env.example` → `.env`, вставьте `YANDEX_WEATHER_KEY`
3. `npm run dev` — Vite проксирует `/api/weather` с кэшем 1 ч (~24 запроса/сутки)

**Продакшн:** `npm run weather-proxy` + Nginx `proxy_pass` на `/api/weather`

При отсутствии геолокации стартовая точка — центр Петропавловска-Камчатского (158.700°E, 53.015°N).

---

## Лицензия

Код приложения — проприетарный, все права защищены.

Картографические данные: © OpenStreetMap contributors (ODbL).  
Тайлы карты: © Mapbox.

Полные атрибуции: `public/attributions.txt`.