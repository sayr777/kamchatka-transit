# 🚀 Инструкция по развёртыванию и установке Transit PWA

## Оглавление

1. [Структура проекта — что где лежит](#1-структура-проекта)
2. [Быстрый старт (5 минут)](#2-быстрый-старт-5-минут)
3. [Запуск фронтенда локально](#3-запуск-фронтенда-локально)
4. [Запуск WebSocket-сервера](#4-запуск-websocket-сервера)
5. [Развёртывание на сервере (продакшн)](#5-развёртывание-на-сервере-продакшн)
6. [Установка приложения на телефон](#6-установка-приложения-на-телефон)
7. [Обновление данных GTFS](#7-обновление-данных-gtfs)
8. [Проверка и диагностика](#8-проверка-и-диагностика)

---

## 1. Структура проекта

Вот **полная структура папок** после распаковки архива:

```
transit-pwa/                        ← корень проекта
│
├── public/                         ← всё что открывает браузер
│   ├── index.html                  ← само приложение (~250 КБ, один файл)
│   ├── manifest.json               ← PWA: имя, иконки, цвет
│   ├── sw.js                       ← Service Worker (офлайн-режим)
│   └── icons/                      ← иконки приложения (SVG-формат)
│       ├── favicon.svg             ← иконка вкладки браузера 32px
│       ├── icon-192.svg            ← иконка на рабочем столе телефона
│       └── icon-512.svg            ← иконка при установке PWA
│
├── doc/                            ← документация
│   ├── DEPLOYMENT.md               ← этот файл
│   ├── ARCHITECTURE.md
│   ├── APP_DESCRIPTION.md
│   ├── WEBSOCKET_API.md
│   └── GTFS_EXTENSIONS.md
│
├── gtfs/                           ← сюда кладёте свои GTFS .txt файлы
│
├── gtfs-rt/
│   └── vehicle_positions.json      ← пример формата GTFS-RT
│
├── scripts/
│   └── build-feed.py               ← упаковка GTFS → feed.zip
│
└── README.md
```

**Важно:** для работы приложения нужна только папка `public/`.  
WebSocket-сервер — опциональный компонент для реального реалтайма.

---

## 2. Быстрый старт (5 минут)

Три команды чтобы запустить и посмотреть:

```bash
# 1. Распаковать архив
unzip transit-pwa-repo.zip
cd repo

# 2. Запустить HTTP-сервер
python3 -m http.server 8000 --directory public

# 3. Открыть в браузере
#    → http://localhost:8000
```

Приложение работает с встроенными GTFS-данными — больше ничего не нужно.

---

## 3. Запуск фронтенда локально

### Почему нельзя просто открыть index.html двойным кликом?

Двойной клик открывает файл по адресу `file:///...` — браузер блокирует Service Worker и некоторые API из соображений безопасности. Нужен настоящий HTTP-сервер.

### Три способа (выберите любой)

**Python 3** — обычно уже установлен:

```bash
python3 -m http.server 8000 --directory public
```

**Node.js** — если установлен:

```bash
npx serve public
```

**PHP** — если установлен:

```bash
php -S localhost:8000 -t public
```

Откройте в браузере: **http://localhost:8000**

Нормальный вывод в терминале:

```
Serving HTTP on 0.0.0.0 port 8000 ...
127.0.0.1 - - [28/Mar/2026] "GET / HTTP/1.1" 200 -
127.0.0.1 - - [28/Mar/2026] "GET /manifest.json HTTP/1.1" 200 -
127.0.0.1 - - [28/Mar/2026] "GET /sw.js HTTP/1.1" 200 -
```

Оставьте этот терминал открытым — пока он работает, сайт доступен.

### Открыть с телефона (в той же Wi-Fi сети)

Узнайте IP вашего компьютера:

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127

# Windows
ipconfig | findstr IPv4
```

Запустите сервер, принимающий внешние подключения:

```bash
python3 -m http.server 8000 --directory public --bind 0.0.0.0
```

Откройте на телефоне: **http://192.168.X.X:8000**

---

## 4. Запуск WebSocket-сервера

> **Без WebSocket-сервера приложение работает** — встроенный симулятор
> генерирует реалистичные ETA на основе GTFS-расписания.  
> Сервер нужен только для подключения **реальных GPS-данных** от автобусов.

### Шаг 1. Установите Node.js

```bash
node --version   # должно быть v18 или новее
```

Если не установлен:

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# macOS
brew install node

# Windows — установщик на https://nodejs.org
```

### Шаг 2. Создайте папку сервера

```bash
# Создать папку (можно любую)
mkdir ~/transit-ws
cd ~/transit-ws
```

### Шаг 3. Инициализируйте Node-проект

```bash
npm init -y
npm install ws
```

Появится папка `node_modules/` и файлы `package.json`, `package-lock.json` — это нормально.

### Шаг 4. Создайте файл server.js

```bash
nano ~/transit-ws/server.js
```

Вставьте следующий код целиком:

```javascript
'use strict';
const WebSocket = require('ws');
const PORT = process.env.WS_PORT || 3000;
const wss  = new WebSocket.Server({ port: PORT });

// Хранилище подписок: ws → { stops: Set, routes: Set }
const subs = new Map();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[+] клиент: ${ip}  всего: ${wss.clients.size}`);
  subs.set(ws, { stops: new Set(), routes: new Set() });

  ws.send(JSON.stringify({
    type: 'connected',
    server_time: Math.floor(Date.now() / 1000),
    version: '1.0', city: 'pk', feed_version: '2026-03-28'
  }));

  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw.toString()); } catch { return; }

    if (m.action === 'subscribe') {
      const s = subs.get(ws);
      (m.stops  || []).forEach(x => s.stops.add(x));
      (m.routes || []).forEach(x => s.routes.add(x));
      ws.send(JSON.stringify({ type: 'subscribed',
        stops: [...s.stops], routes: [...s.routes], ts: Date.now() }));
      console.log(`   subscribe: ${s.stops.size} остановок, ${s.routes.size} маршрутов`);
    }
    if (m.action === 'unsubscribe') {
      const s = subs.get(ws);
      (m.stops  || []).forEach(x => s.stops.delete(x));
      (m.routes || []).forEach(x => s.routes.delete(x));
    }
    if (m.action === 'ping') ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
  });

  ws.on('close', () => { subs.delete(ws); console.log(`[-] клиент отключён  всего: ${wss.clients.size}`); });
  ws.on('error', console.error);
});

function broadcast(event) {
  for (const [ws, s] of subs) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if ((event.stop_id  && s.stops.has(event.stop_id))   ||
        (event.route_id && s.routes.has(event.route_id)) ||
         event.type === 'alert' || event.type === 'heartbeat')
      ws.send(JSON.stringify(event));
  }
}

// Heartbeat каждые 30 сек
setInterval(() => broadcast({ type: 'heartbeat', ts: Date.now(), clients: wss.clients.size }), 30_000);

// Демо: случайные ETA (замените на реальный GTFS-RT)
const STOPS  = ['stop_260328_80828','stop_260328_27515','stop_260328_76068'];
const ROUTES = ['route_260328_42721','route_260328_20893','route_260328_13897'];
setInterval(() => {
  broadcast({ type: 'arrival',
    stop_id:  STOPS [Math.floor(Math.random() * STOPS.length)],
    route_id: ROUTES[Math.floor(Math.random() * ROUTES.length)],
    eta:   Math.floor(30 + Math.random() * 900),
    delay: Math.floor((Math.random() - 0.5) * 120),
    ts: Date.now() });
}, 5_000);

console.log('🚌 WebSocket-сервер запущен');
console.log(`   Порт: ${PORT}`);
console.log(`   URL:  ws://localhost:${PORT}`);
console.log('   Остановить: Ctrl+C\n');
```

Сохраните: `Ctrl+O` → `Enter` → `Ctrl+X`

### Шаг 5. Запустите сервер

```bash
cd ~/transit-ws
node server.js
```

Вы увидите:

```
🚌 WebSocket-сервер запущен
   Порт: 3000
   URL:  ws://localhost:3000
   Остановить: Ctrl+C
```

Сервер работает. **Оставьте терминал открытым.**

### Шаг 6. Подключите приложение к серверу

1. Откройте приложение: `http://localhost:8000`
2. Нажмите кнопку **🛰 Офлайн** (верхний левый угол карты)
3. В поле введите адрес: `ws://localhost:3000`
4. Нажмите **«Подключить»**
5. Бейдж изменится на **🟢 Live**

### Остановка, перезапуск, другой порт

```bash
# Остановить (в терминале где запущен):
Ctrl+C

# Перезапустить:
node server.js

# Запустить на другом порту:
WS_PORT=4000 node server.js
# Тогда подключаться: ws://localhost:4000
```

### Автозапуск через PM2 (чтобы сервер не падал)

```bash
# Установить PM2
sudo npm install -g pm2

# Запустить под управлением PM2
pm2 start ~/transit-ws/server.js --name transit-ws

# Добавить в автозапуск при перезагрузке ОС
pm2 startup         # скопируйте и выполните команду из вывода
pm2 save            # сохранить список процессов

# Управление
pm2 status                # все процессы и их состояние
pm2 logs transit-ws       # логи в реальном времени
pm2 restart transit-ws    # перезапустить
pm2 stop transit-ws       # остановить
```

---

## 5. Развёртывание на сервере (продакшн)

### Что понадобится

- VPS с Ubuntu 22.04 LTS (минимум 1 vCPU, 512 МБ RAM)
- Доменное имя (для HTTPS — обязателен при установке PWA)
- Открытые порты: 22, 80, 443

### Установка

```bash
# Подключиться
ssh user@ВАШ_IP

# Обновить систему
sudo apt update && sudo apt upgrade -y

# Установить Nginx
sudo apt install -y nginx

# Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Разместить фронтенд

```bash
# На сервере: создать папку
sudo mkdir -p /var/www/transit-pwa
sudo chown $USER:$USER /var/www/transit-pwa

# С локального компьютера: скопировать файлы
scp -r public/* user@ВАШ_IP:/var/www/transit-pwa/
```

Проверить на сервере:

```bash
ls /var/www/transit-pwa/
# index.html  manifest.json  sw.js  icons/
```

### Настроить Nginx

```bash
sudo nano /etc/nginx/sites-available/transit-pwa
```

Вставить (заменить домен):

```nginx
server {
    listen 80;
    server_name transit.ваш-домен.ru;

    root  /var/www/transit-pwa;
    index index.html;

    gzip on;
    gzip_types text/html application/javascript application/json image/svg+xml;

    location ~* \.svg$ { expires 1y; add_header Cache-Control "public, immutable"; }
    location = /sw.js   { add_header Cache-Control "no-cache, no-store"; }
    location = /manifest.json { add_header Cache-Control "no-cache"; }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }

    location / { try_files $uri /index.html; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/transit-pwa /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### HTTPS (обязательно для PWA)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d transit.ваш-домен.ru
```

После этого сайт доступен по `https://transit.ваш-домен.ru` ✅

### Развернуть WS-сервер на продакшне

```bash
# Создать папку
sudo mkdir /opt/transit-ws && sudo chown $USER:$USER /opt/transit-ws

# Загрузить server.js (с локального компьютера)
scp ~/transit-ws/server.js user@ВАШ_IP:/opt/transit-ws/

# На сервере — установить зависимости и запустить
cd /opt/transit-ws
npm init -y && npm install ws
sudo npm install -g pm2
pm2 start server.js --name transit-ws
pm2 startup && pm2 save
```

---

## 6. Установка приложения на телефон

### Android — Chrome

1. Откройте Chrome, перейдите на сайт
2. Внизу появится баннер → нажмите **«Установить»**

Если баннер не появился: меню ⋮ → **«Добавить на главный экран»**

### iOS — Safari

> Только через Safari! Chrome на iOS не поддерживает установку PWA.

1. Откройте Safari, перейдите на сайт
2. Кнопка **Поделиться** ↑ → **«На экран "Домой"»** → **«Добавить»**

### ПК — Chrome или Edge

В адресной строке справа появится иконка ⊕ → нажмите → **«Установить»**

---

## 7. Обновление данных GTFS

```bash
# Положите обновлённые .txt файлы в папку gtfs/
# Упакуйте:
python3 scripts/build-feed.py --input ./gtfs --output ./public/feed.zip

# Загрузите на сервер:
scp public/feed.zip user@SERVER:/var/www/transit-pwa/feed.zip
```

Пользователям ничего делать не нужно — приложение само подтянет обновление.

---

## 8. Проверка и диагностика

### Быстрая проверка

```bash
# Сайт отвечает?
curl -I http://localhost:8000
# Ожидаем: HTTP/1.0 200 OK

# WS-сервер запущен?
wscat -c ws://localhost:3000          # npm install -g wscat
# Ожидаем: Connected  затем  {"type":"connected",...}

# На продакшне
curl -I https://transit.ваш-домен.ru  # HTTP/2 200
wscat -c wss://transit.ваш-домен.ru/ws
```

### Частые проблемы

| Симптом | Причина | Решение |
|---------|---------|---------|
| Белый экран | Открыт через `file://` | Запустить HTTP-сервер |
| WS не подключается | Сервер не запущен | `pm2 status` → `pm2 restart transit-ws` |
| Не предлагает установку | Нет HTTPS | Настроить Certbot |
| Иконки не появляются | Нет файлов в `icons/` | `ls public/icons/` → должны быть .svg |

### Логи

```bash
# Nginx
sudo tail -f /var/log/nginx/error.log

# WS-сервер
pm2 logs transit-ws
```

---

## Шпаргалка

```bash
# ─── ЛОКАЛЬНАЯ РАЗРАБОТКА ─────────────────────────────────

# Запустить приложение
python3 -m http.server 8000 --directory public
# Открыть: http://localhost:8000

# Запустить WS-сервер (отдельный терминал)
node ~/transit-ws/server.js
# Адрес для приложения: ws://localhost:3000

# ─── ПРОДАКШН ────────────────────────────────────────────

# Загрузить фронтенд
scp -r public/* user@IP:/var/www/transit-pwa/

# Перезагрузить Nginx
sudo systemctl reload nginx

# WS-сервер
pm2 status                      # статус
pm2 restart transit-ws          # перезапустить
pm2 logs transit-ws             # логи

# SSL сертификат
sudo certbot --nginx -d ваш-домен.ru

# ─── ДАННЫЕ ──────────────────────────────────────────────

# Обновить GTFS
python3 scripts/build-feed.py --input ./gtfs --output ./public/feed.zip
scp public/feed.zip user@IP:/var/www/transit-pwa/
```
