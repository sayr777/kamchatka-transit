# Инструкция по развёртыванию и установке Transit PWA

> Актуально для React-версии (Vite). Legacy без сборки: `public/app.html`.

## Оглавление

1. [Структура проекта](#1-структура-проекта)
2. [Быстрый старт (разработка)](#2-быстрый-старт-разработка)
3. [Сборка production](#3-сборка-production)
4. [Запуск WebSocket-сервера](#4-запуск-websocket-сервера)
5. [Развёртывание на сервере](#5-развёртывание-на-сервере)
6. [Установка на телефон](#6-установка-на-телефон)
7. [Обновление данных GTFS](#7-обновление-данных-gtfs)
8. [Проверка и диагностика](#8-проверка-и-диагностика)

---

## 1. Структура проекта

```
pwa/
├── index.html              # Точка входа Vite
├── vite.config.js          # Vite + React + PWA (Workbox)
├── package.json
│
├── src/                    # Исходники React-приложения
│   ├── App.jsx
│   ├── store/appStore.js
│   ├── gtfs/               # loader, worker, precache
│   ├── realtime/           # vehicleTracker.js
│   └── components/
│
├── public/                 # Статические ассеты (копируются в dist/)
│   ├── app.html            # Legacy single-file приложение
│   ├── gtfs_ru.zip …       # Языковые GTFS-архивы
│   ├── gtfs/               # Исходные .txt
│   ├── icons/              # PWA-иконки
│   └── vendor/             # Библиотеки для legacy
│
├── dist/                   # Результат npm run build → деплоить это
│
├── doc/                    # Документация
├── scripts/validate-feed.py
└── tests/                  # Vitest + Playwright
```

**Для продакшна** нужна папка `dist/` после `npm run build`.  
WebSocket-сервер — опциональный компонент для реального реалтайма.

---

## 2. Быстрый старт (разработка)

### Требования

- Node.js 18+
- npm

### Запуск dev-сервера

```bash
git clone https://github.com/sayr777/kamchatka-transit.git
cd kamchatka-transit   # или pwa/
npm install
npm run dev
```

Откройте: **http://localhost:5173**

Доступ с телефона в той же Wi-Fi сети:

```bash
npm run dev -- --host
# → http://<IP-вашего-компьютера>:5173
```

### Почему нельзя открыть файл двойным кликом?

`file://` блокирует Service Worker, Web Workers и fetch. Нужен HTTP-сервер (Vite dev или preview).

### Тесты

```bash
npm run test        # 153 теста (utils + weather + gtfs + search + stop-focus)
npm run test:unit   # 102 (utils + weather)
npm run test:gtfs   # 51 (gtfs + i18n + search + stop-focus)
npm run test:e2e    # Playwright (нужен запущенный preview)
npm run test:all    # всё вместе
```

### Погода (dev)

```bash
cp .env.example .env   # YANDEX_WEATHER_KEY=...
npm run dev            # прокси /api/weather на :5173
```

### Legacy без Node.js

```bash
python3 -m http.server 8000 --directory public
# → http://localhost:8000/app.html
```

---

## 3. Сборка production

```bash
npm run build
```

Результат в `dist/`:

```
dist/
├── index.html              # React-приложение
├── sw.js                   # Workbox Service Worker
├── manifest.webmanifest
├── assets/                 # JS/CSS chunks (maplibre, deckgl, react)
├── gtfs_ru.zip …          # GTFS-архивы из public/
├── icons/
└── app.html                # Legacy (для обратной совместимости)
```

Локальный просмотр сборки:

```bash
npm run preview
# → http://localhost:4173
```

---

## 4. Запуск WebSocket-сервера

> Без WS-сервера приложение работает — встроенный симулятор двигает автобусы по GTFS-данным.  
> Сервер нужен для **реальных GPS-данных**.

### Подключение в React-версии

Передайте URL в `startVehicleTracker()` в `src/App.jsx`:

```javascript
startVehicleTracker('ws://localhost:3000');
// или wss://transit.ваш-домен.ru/ws для продакшна
```

По умолчанию: `startVehicleTracker(null)` — только симулятор.

### Минимальный WS-сервер (Node.js)

```bash
mkdir ~/transit-ws && cd ~/transit-ws
npm init -y && npm install ws
```

Создайте `server.js` (полный код — в `doc/WEBSOCKET_API.md`, раздел Reference Implementation).

```bash
node server.js
# → ws://localhost:3000
```

### Автозапуск через PM2

```bash
sudo npm install -g pm2
pm2 start ~/transit-ws/server.js --name transit-ws
pm2 startup && pm2 save
```

---

## 5. Развёртывание на сервере

### Что понадобится

- VPS (Ubuntu 22.04+, 1 vCPU, 512 МБ RAM)
- Доменное имя (HTTPS обязателен для PWA)
- Порты: 22, 80, 443

### Сборка и загрузка

```bash
# Локально
npm run build

# На сервер
ssh user@ВАШ_IP
sudo mkdir -p /var/www/transit-pwa
sudo chown $USER:$USER /var/www/transit-pwa

# С локального компьютера
scp -r dist/* user@ВАШ_IP:/var/www/transit-pwa/
```

### Nginx

```bash
sudo nano /etc/nginx/sites-available/transit-pwa
```

```nginx
server {
    listen 80;
    server_name transit.ваш-домен.ru;

    root  /var/www/transit-pwa;
    index index.html;

    gzip on;
    gzip_types text/html application/javascript application/json text/css image/svg+xml;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.(zip)$ {
        expires 7d;
        add_header Cache-Control "public";
    }

    location = /sw.js {
        add_header Cache-Control "no-cache, no-store";
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/transit-pwa /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d transit.ваш-домен.ru
```

### Прокси погоды (бесплатный тариф Яндекса)

Лимит API: **50 запросов/сутки**. Прокси кэширует ответ 1 час (~24 req/день).

```bash
# На сервере (фоном через PM2)
YANDEX_WEATHER_KEY=xxx pm2 start npm --name weather-proxy -- run weather-proxy
```

В Nginx добавьте перед `location /`:

```nginx
location /api/weather {
    proxy_pass http://127.0.0.1:8787;
    proxy_cache_valid 200 1h;
}
```

Ключ берётся на [developer.tech.yandex.ru](https://developer.tech.yandex.ru/) (сервис «Погода»).

### WS-сервер на продакшне

```bash
sudo mkdir /opt/transit-ws && sudo chown $USER:$USER /opt/transit-ws
scp ~/transit-ws/server.js user@ВАШ_IP:/opt/transit-ws/
ssh user@ВАШ_IP "cd /opt/transit-ws && npm init -y && npm install ws"
pm2 start server.js --name transit-ws
pm2 startup && pm2 save
```

### GitHub Pages

Для статического хостинга на GitHub Pages деплойте содержимое `dist/` в ветку `gh-pages` или в `public/` репозитория. GTFS-архивы уже доступны по адресу:

`https://sayr777.github.io/kamchatka-transit/public/gtfs_ru.zip`

---

## 6. Установка на телефон

### Android — Chrome

1. Откройте сайт по HTTPS
2. Баннер «Установить» внизу экрана
3. Или: меню ⋮ → «Добавить на главный экран»

### iOS — Safari

> Только Safari! Chrome на iOS не поддерживает установку PWA.

1. Откройте сайт в Safari
2. Поделиться ↑ → «На экран "Домой"» → «Добавить»

### ПК — Chrome / Edge

Иконка ⊕ в адресной строке → «Установить»

Страница-помощник: `public/install.html` (QR-код, инструкции).

---

## 7. Обновление данных GTFS

### Исходные файлы

```
public/gtfs/
├── agency.txt, routes.txt, trips.txt, stops.txt
├── stop_times.txt, shapes.txt, calendar.txt
└── vehicles.txt, vehicle_trips.txt  (расширения)
```

### Проверка

```bash
npm run validate
# python scripts/validate-feed.py public/gtfs
```

### Упаковка языковых ZIP

```bash
# Рекомендуемый способ — скрипт переводов
npm run build:gtfs
```

Скрипт читает `public/gtfs/`, применяет `scripts/gtfs-translations.mjs`, пишет каталоги `gtfs_en/`, `gtfs_zh/`, `gtfs_ja/` и ZIP-архивы. Кэш загрузчика: `gtfs-feeds-v2` — после обновления фида пользователям может понадобиться hard refresh.

### Деплой

```bash
npm run build
scp -r dist/gtfs_*.zip user@SERVER:/var/www/transit-pwa/
```

Приложение подтянет обновление через `refreshFeedsInBackground()` при следующем онлайн-запуске.

---

## 8. Проверка и диагностика

### Быстрая проверка

```bash
# Dev-сервер
curl -I http://localhost:5173

# Production preview
npm run preview &
curl -I http://localhost:4173

# WS-сервер
wscat -c ws://localhost:3000    # npm install -g wscat

# Продакшн
curl -I https://transit.ваш-домен.ru
```

### Частые проблемы

| Симптом | Причина | Решение |
|---------|---------|---------|
| Белый экран | `file://` или ошибка сборки | `npm run dev`, проверить консоль |
| GTFS не грузится | Нет сети и кэша | Проверить URL в `loader.js`, наличие ZIP |
| PWA не устанавливается | Нет HTTPS | Certbot |
| WS не подключается | URL не задан / сервер не запущен | `App.jsx` → `startVehicleTracker(url)` |
| Старые данные | Кэш SW | Hard refresh, очистить кэш сайта |

### Логи

```bash
# Браузер: DevTools → Console
# Фильтры: [GTFS], [RT], [offline]

# Nginx
sudo tail -f /var/log/nginx/error.log

# WS-сервер
pm2 logs transit-ws
```

---

## Шпаргалка

```bash
# ─── РАЗРАБОТКА ──────────────────────────────────────────
npm install
npm run dev                              # :5173
npm run build && npm run preview         # :4173

# ─── ПРОДАКШН ────────────────────────────────────────────
npm run build
scp -r dist/* user@IP:/var/www/transit-pwa/
sudo systemctl reload nginx

# WS
pm2 restart transit-ws

# ─── ДАННЫЕ ──────────────────────────────────────────────
npm run validate
npm run build   # после обновления gtfs/*.txt и ZIP
```