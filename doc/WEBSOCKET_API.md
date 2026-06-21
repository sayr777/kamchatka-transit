# WebSocket API — Transit PWA

## Оглавление

1. [Обзор протокола](#1-обзор-протокола)
2. [Подключение и аутентификация](#2-подключение-и-аутентификация)
3. [Типы сообщений Client → Server](#3-типы-сообщений-client--server)
4. [Типы событий Server → Client](#4-типы-событий-server--client)
5. [Коды ошибок](#5-коды-ошибок)
6. [TTL и устаревание данных](#6-ttl-и-устаревание-данных)
7. [OpenAPI AsyncAPI Specification](#7-openapi-asyncapi-specification)
8. [Reference Implementation (Node.js)](#8-reference-implementation-nodejs)
9. [Тестирование без сервера](#9-тестирование-без-сервера)
10. [Масштабирование](#10-масштабирование)

---

## 1. Обзор протокола

### Транспортный уровень

```
Protocol:    WebSocket (RFC 6455)
Format:      JSON (UTF-8)
Framing:     Text frames
Compression: permessage-deflate (рекомендуется)
```

### Концепция

Клиент **подписывается** на конкретные остановки и/или маршруты. Сервер **фильтрует** входящий поток GTFS-RT и отправляет только релевантные события. Это минимизирует трафик и нагрузку на клиент.

```
AVL/GPS → [GTFS-RT Adapter] → [WS Server] → [Redis pub/sub] → [WS Nodes] → Clients
```

### URL схема

```
ws://host:port/transit/ws
wss://host:port/transit/ws    ← production (TLS)
```

Параметры строки запроса (опционально):

```
ws://host:3000/transit/ws?city=pk&version=1
```

---

## 2. Подключение и аутентификация

### Handshake

```http
GET /transit/ws HTTP/1.1
Host: host:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

### После подключения

Сервер отправляет приветственное сообщение:

```json
{
  "type": "connected",
  "server_time": 1711612800,
  "version": "1.0",
  "city": "pk",
  "feed_version": "2026-03-28"
}
```

### Аутентификация (опционально)

Если сервер требует токен:

```json
{
  "action": "auth",
  "token": "YOUR_API_TOKEN"
}
```

Ответ при успехе:

```json
{
  "type": "auth_ok",
  "expires_at": 1711699200
}
```

Ответ при ошибке:

```json
{
  "type": "error",
  "code": 401,
  "message": "Invalid token"
}
```

---

## 3. Типы сообщений Client → Server

### 3.1 subscribe — Подписка

Клиент сообщает серверу, на какие данные он подписан. Сервер будет отправлять только события для указанных остановок и маршрутов.

```json
{
  "action": "subscribe",
  "stops": ["stop_id_1", "stop_id_2"],
  "routes": ["route_id_1", "route_id_2"]
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `action` | string | ✓ | `"subscribe"` |
| `stops` | string[] | | Массив stop_id из GTFS |
| `routes` | string[] | | Массив route_id из GTFS |

Ответ сервера:

```json
{
  "type": "subscribed",
  "stops": ["stop_id_1", "stop_id_2"],
  "routes": ["route_id_1"],
  "ts": 1711612800000
}
```

### 3.2 unsubscribe — Отписка

```json
{
  "action": "unsubscribe",
  "stops": ["stop_id_1"],
  "routes": []
}
```

### 3.3 ping — Heartbeat (клиент → сервер)

```json
{
  "action": "ping",
  "ts": 1711612800000
}
```

Ответ:

```json
{
  "type": "pong",
  "ts": 1711612800001
}
```

### 3.4 get_snapshot — Разовый запрос состояния

Полезно при переподключении — запросить актуальное состояние без ожидания следующего события.

```json
{
  "action": "get_snapshot",
  "stop_id": "stop_123",
  "route_id": "route_456"
}
```

Ответ — несколько событий `arrival` для текущих рейсов.

---

## 4. Типы событий Server → Client

### 4.1 arrival — ETA прибытия

Основное событие. Содержит актуальное время до прибытия следующего автобуса.

```json
{
  "type": "arrival",
  "stop_id": "stop_260328_80828",
  "route_id": "route_260328_42721",
  "trip_id": "trip_260328_45222",
  "eta": 180,
  "scheduled_eta": 240,
  "delay": -60,
  "vehicle_id": "vehicle_01",
  "ts": 1711612800000
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | string | `"arrival"` |
| `stop_id` | string | ID остановки из GTFS |
| `route_id` | string | ID маршрута из GTFS |
| `trip_id` | string | ID рейса (конкретный рейс) |
| `eta` | integer | Секунд до прибытия (реалтайм) |
| `scheduled_eta` | integer | Секунд по расписанию |
| `delay` | integer | Задержка в секундах (отрицательно = едет быстро) |
| `vehicle_id` | string | ID транспортного средства |
| `ts` | integer | Unix timestamp события (мс) |

**Специальные значения eta:**
- `0` — автобус на остановке прямо сейчас
- `-1` — рейс завершён или отменён
- `null` — ETA неизвестен, использовать расписание

### 4.2 vehicle — Позиция транспортного средства

```json
{
  "type": "vehicle",
  "id": "vehicle_260328_37612",
  "label": "У214АХ 41",
  "lat": 53.0702,
  "lon": 158.6035,
  "bearing": 275,
  "speed": 9.2,
  "route_id": "route_260328_42721",
  "trip_id": "trip_260328_45222",
  "occupancy": 45,
  "ts": 1711612800000
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | string | `"vehicle"` |
| `id` | string | ID ТС из vehicles.txt |
| `label` | string | Гос. номер для отображения |
| `lat` | float | Широта WGS84 |
| `lon` | float | Долгота WGS84 |
| `bearing` | integer | Курс в градусах (0–359) |
| `speed` | float | Скорость м/с |
| `route_id` | string | Текущий маршрут |
| `trip_id` | string | Текущий рейс |
| `occupancy` | integer | Заполненность 0–100% |
| `ts` | integer | Unix timestamp (мс) |

**Значения occupancy:**
- 0–40: Свободно (зелёный)
- 41–74: Умеренно (жёлтый)
- 75–100: Заполнено (красный)

### 4.3 alert — Оперативное сообщение

```json
{
  "type": "alert",
  "id": "alert_001",
  "severity": 2,
  "title": "ДТП",
  "text": "ул. Ленинская, д. 12 — перекрытие правого ряда",
  "impact": "Задержки ~8 мин",
  "routes_affected": ["route_260328_42721", "route_260328_84939"],
  "stops_affected": ["stop_260328_80828"],
  "lat": 53.048,
  "lon": 158.658,
  "icon": "accident",
  "valid_until": 1711616400000,
  "ts": 1711612800000
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `severity` | integer | 0 — информация, 1 — предупреждение, 2 — критично |
| `icon` | string | `accident` / `construction` / `restriction` / `weather` |
| `valid_until` | integer | До какого момента актуально (Unix ms) |

### 4.4 trip_update — Изменение рейса

```json
{
  "type": "trip_update",
  "trip_id": "trip_260328_45222",
  "route_id": "route_260328_42721",
  "updates": [
    {
      "stop_id": "stop_260328_80828",
      "arrival_delay": -60,
      "departure_delay": -60
    }
  ],
  "ts": 1711612800000
}
```

### 4.5 heartbeat — Серверный пинг

```json
{
  "type": "heartbeat",
  "ts": 1711612800000,
  "connected_clients": 42
}
```

Отправляется каждые 30 секунд. Клиент должен отвечать ping или считается отключённым.

---

## 5. Коды ошибок

```json
{
  "type": "error",
  "code": 429,
  "message": "Rate limit exceeded",
  "retry_after": 5000
}
```

| Код | Значение |
|-----|---------|
| 400 | Неверный формат JSON |
| 401 | Требуется аутентификация |
| 403 | Нет прав на данный ресурс |
| 404 | Остановка/маршрут не найдены |
| 429 | Слишком много запросов (> 100/мин) |
| 500 | Внутренняя ошибка сервера |
| 503 | Сервер временно недоступен |

---

## 6. TTL и устаревание данных

### Клиентская логика

```javascript
const WS_TTL_MS = 45_000  // 45 секунд

// Очистка устаревших данных каждые 10 секунд
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of WS.etaMap) {
    if (now - val.ts > WS_TTL_MS) {
      WS.etaMap.delete(key)  // Возврат к статическому расписанию
    }
  }
}, 10_000)
```

### Серверные рекомендации

| Тип данных | Рекомендуемый TTL | Частота обновления |
|-----------|------------------|--------------------|
| Позиции ТС | 30 сек | каждые 5–15 сек |
| ETA arrival | 60 сек | при изменении |
| Alert | до valid_until | при создании/отмене |
| Trip update | 120 сек | при изменении |

---

## 7. OpenAPI AsyncAPI Specification

```yaml
asyncapi: "2.6.0"

info:
  title: Transit PWA WebSocket API
  version: "1.0.0"
  description: |
    Реалтайм WebSocket API для транспортного PWA.
    Предоставляет ETA прибытия, позиции ТС и дорожные события.
  contact:
    name: АО Автопарк
    url: https://pkgo.ru
  license:
    name: MIT

servers:
  production:
    url: wss://transit.pkgo.ru/ws
    protocol: wss
    description: Production WebSocket сервер
  development:
    url: ws://localhost:3000/ws
    protocol: ws
    description: Development сервер

channels:
  /transit/ws:
    description: Основной канал реалтайм данных
    bindings:
      ws:
        method: GET
        query:
          type: object
          properties:
            city:
              type: string
              default: pk
            version:
              type: string
              default: "1"

    publish:
      summary: Сообщения от клиента к серверу
      operationId: clientMessages
      message:
        oneOf:
          - $ref: '#/components/messages/SubscribeMessage'
          - $ref: '#/components/messages/UnsubscribeMessage'
          - $ref: '#/components/messages/PingMessage'
          - $ref: '#/components/messages/GetSnapshotMessage'

    subscribe:
      summary: События от сервера к клиенту
      operationId: serverEvents
      message:
        oneOf:
          - $ref: '#/components/messages/ConnectedEvent'
          - $ref: '#/components/messages/ArrivalEvent'
          - $ref: '#/components/messages/VehicleEvent'
          - $ref: '#/components/messages/AlertEvent'
          - $ref: '#/components/messages/TripUpdateEvent'
          - $ref: '#/components/messages/HeartbeatEvent'
          - $ref: '#/components/messages/ErrorEvent'

components:
  messages:

    # ── CLIENT MESSAGES ──────────────────────

    SubscribeMessage:
      name: subscribe
      title: Подписка на обновления
      summary: Клиент подписывается на остановки и/или маршруты
      payload:
        $ref: '#/components/schemas/SubscribePayload'
      examples:
        - name: Подписка на остановку
          payload:
            action: subscribe
            stops: ["stop_260328_80828"]
            routes: ["route_260328_42721"]

    UnsubscribeMessage:
      name: unsubscribe
      title: Отписка
      payload:
        $ref: '#/components/schemas/UnsubscribePayload'

    PingMessage:
      name: ping
      title: Heartbeat от клиента
      payload:
        type: object
        required: [action]
        properties:
          action:
            type: string
            const: ping
          ts:
            type: integer
            description: Unix timestamp клиента (мс)

    GetSnapshotMessage:
      name: get_snapshot
      title: Запрос актуального состояния
      payload:
        type: object
        required: [action]
        properties:
          action:
            type: string
            const: get_snapshot
          stop_id:
            type: string
          route_id:
            type: string

    # ── SERVER EVENTS ─────────────────────────

    ConnectedEvent:
      name: connected
      title: Успешное подключение
      payload:
        type: object
        properties:
          type:
            type: string
            const: connected
          server_time:
            type: integer
          version:
            type: string
          city:
            type: string
          feed_version:
            type: string

    ArrivalEvent:
      name: arrival
      title: Событие прибытия автобуса
      summary: ETA следующего автобуса на остановку по маршруту
      payload:
        $ref: '#/components/schemas/ArrivalEventPayload'
      examples:
        - name: Автобус через 3 минуты
          payload:
            type: arrival
            stop_id: stop_260328_80828
            route_id: route_260328_42721
            trip_id: trip_260328_45222
            eta: 180
            scheduled_eta: 240
            delay: -60
            vehicle_id: vehicle_260328_37612
            ts: 1711612800000

    VehicleEvent:
      name: vehicle
      title: Позиция транспортного средства
      summary: GPS-координаты автобуса в реальном времени
      payload:
        $ref: '#/components/schemas/VehicleEventPayload'

    AlertEvent:
      name: alert
      title: Дорожное событие или оперативное сообщение
      payload:
        $ref: '#/components/schemas/AlertEventPayload'

    TripUpdateEvent:
      name: trip_update
      title: Обновление задержек рейса
      payload:
        $ref: '#/components/schemas/TripUpdatePayload'

    HeartbeatEvent:
      name: heartbeat
      title: Серверный пинг каждые 30 секунд
      payload:
        type: object
        properties:
          type:
            type: string
            const: heartbeat
          ts:
            type: integer
          connected_clients:
            type: integer

    ErrorEvent:
      name: error
      title: Ошибка обработки запроса
      payload:
        $ref: '#/components/schemas/ErrorPayload'

  schemas:

    SubscribePayload:
      type: object
      required: [action]
      properties:
        action:
          type: string
          const: subscribe
          description: Тип сообщения
        stops:
          type: array
          items:
            type: string
          description: Массив stop_id из GTFS
          maxItems: 50
        routes:
          type: array
          items:
            type: string
          description: Массив route_id из GTFS
          maxItems: 20

    UnsubscribePayload:
      type: object
      required: [action]
      properties:
        action:
          type: string
          const: unsubscribe
        stops:
          type: array
          items:
            type: string
        routes:
          type: array
          items:
            type: string

    ArrivalEventPayload:
      type: object
      required: [type, stop_id, route_id, eta, ts]
      properties:
        type:
          type: string
          const: arrival
        stop_id:
          type: string
          description: ID остановки (GTFS stop_id)
        route_id:
          type: string
          description: ID маршрута (GTFS route_id)
        trip_id:
          type: string
          description: ID конкретного рейса
        eta:
          type: integer
          nullable: true
          description: |
            Секунд до прибытия.
            null = ETA неизвестен.
            -1 = рейс отменён.
            0 = автобус на остановке.
          minimum: -1
        scheduled_eta:
          type: integer
          description: ETA по расписанию в секундах
          minimum: 0
        delay:
          type: integer
          description: Задержка в секундах (отрицательно = опережает)
        vehicle_id:
          type: string
          description: ID транспортного средства
        ts:
          type: integer
          description: Unix timestamp события в миллисекундах

    VehicleEventPayload:
      type: object
      required: [type, id, lat, lon, ts]
      properties:
        type:
          type: string
          const: vehicle
        id:
          type: string
          description: vehicle_id из vehicles.txt
        label:
          type: string
          description: Гос. номер для отображения (У214АХ 41)
        lat:
          type: number
          format: double
          minimum: -90
          maximum: 90
          description: Широта WGS84
        lon:
          type: number
          format: double
          minimum: -180
          maximum: 180
          description: Долгота WGS84
        bearing:
          type: integer
          minimum: 0
          maximum: 359
          description: Курс в градусах (0 = север)
        speed:
          type: number
          description: Скорость в м/с
          minimum: 0
        route_id:
          type: string
          description: Текущий route_id
        trip_id:
          type: string
          description: Текущий trip_id
        occupancy:
          type: integer
          description: Заполненность 0–100%
          minimum: 0
          maximum: 100
        ts:
          type: integer
          description: Unix timestamp в миллисекундах

    AlertEventPayload:
      type: object
      required: [type, id, severity, title, text, ts]
      properties:
        type:
          type: string
          const: alert
        id:
          type: string
          description: Уникальный ID события
        severity:
          type: integer
          enum: [0, 1, 2]
          description: |
            0 = информация (серый),
            1 = предупреждение (янтарный),
            2 = критично (красный)
        title:
          type: string
          maxLength: 100
        text:
          type: string
          maxLength: 500
          description: Подробное описание события
        impact:
          type: string
          maxLength: 200
          description: Оценка последствий (Задержки ~8 мин)
        routes_affected:
          type: array
          items:
            type: string
          description: route_id затронутых маршрутов
        stops_affected:
          type: array
          items:
            type: string
          description: stop_id затронутых остановок
        lat:
          type: number
          description: Координата события (широта)
        lon:
          type: number
          description: Координата события (долгота)
        icon:
          type: string
          enum: [accident, construction, restriction, weather, other]
        valid_until:
          type: integer
          description: До какого момента актуально (Unix ms). null = бессрочно
          nullable: true
        ts:
          type: integer
          description: Unix timestamp создания события (мс)

    TripUpdatePayload:
      type: object
      required: [type, trip_id, route_id, updates, ts]
      properties:
        type:
          type: string
          const: trip_update
        trip_id:
          type: string
        route_id:
          type: string
        updates:
          type: array
          items:
            type: object
            properties:
              stop_id:
                type: string
              arrival_delay:
                type: integer
                description: Задержка прибытия в секундах
              departure_delay:
                type: integer
                description: Задержка отправления в секундах
              skipped:
                type: boolean
                description: Остановка пропущена
        ts:
          type: integer

    ErrorPayload:
      type: object
      required: [type, code, message]
      properties:
        type:
          type: string
          const: error
        code:
          type: integer
          description: HTTP-подобный код ошибки
        message:
          type: string
          description: Человекочитаемое описание
        retry_after:
          type: integer
          description: Через сколько мс можно повторить (для 429)
```

---

## 8. Reference Implementation (Node.js)

### Минимальный WS сервер

```javascript
// server.js
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 3000 })

// Хранилище подписок
const subscriptions = new Map()  // ws → { stops: Set, routes: Set }

wss.on('connection', (ws) => {
  subscriptions.set(ws, { stops: new Set(), routes: new Set() })

  // Приветствие
  ws.send(JSON.stringify({
    type: 'connected',
    server_time: Math.floor(Date.now() / 1000),
    version: '1.0',
    city: 'pk',
    feed_version: '2026-03-28'
  }))

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data) } catch { return }

    if (msg.action === 'subscribe') {
      const sub = subscriptions.get(ws)
      ;(msg.stops || []).forEach(s => sub.stops.add(s))
      ;(msg.routes || []).forEach(r => sub.routes.add(r))
      ws.send(JSON.stringify({
        type: 'subscribed',
        stops: [...sub.stops],
        routes: [...sub.routes],
        ts: Date.now()
      }))
    }

    if (msg.action === 'unsubscribe') {
      const sub = subscriptions.get(ws)
      ;(msg.stops || []).forEach(s => sub.stops.delete(s))
      ;(msg.routes || []).forEach(r => sub.routes.delete(r))
    }

    if (msg.action === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
    }
  })

  ws.on('close', () => subscriptions.delete(ws))
})

// Публикация события всем подписанным клиентам
function broadcast(event) {
  for (const [ws, sub] of subscriptions) {
    if (ws.readyState !== WebSocket.OPEN) continue
    
    const shouldSend =
      (event.stop_id  && sub.stops.has(event.stop_id)) ||
      (event.route_id && sub.routes.has(event.route_id)) ||
      event.type === 'alert'  // алерты всем
    
    if (shouldSend) ws.send(JSON.stringify(event))
  }
}

// Пример: получение GTFS-RT и трансляция
function processGtfsRt(feedMessage) {
  for (const entity of feedMessage.entity) {
    if (entity.tripUpdate) {
      const { tripUpdate } = entity
      for (const stu of tripUpdate.stopTimeUpdate) {
        broadcast({
          type: 'arrival',
          stop_id: stu.stopId,
          route_id: tripUpdate.trip.routeId,
          trip_id: tripUpdate.trip.tripId,
          eta: stu.arrival?.time 
            ? Math.round(stu.arrival.time - Date.now() / 1000) 
            : null,
          delay: stu.arrival?.delay || 0,
          ts: Date.now()
        })
      }
    }
    if (entity.vehicle) {
      const { vehicle } = entity
      broadcast({
        type: 'vehicle',
        id: vehicle.vehicle?.id,
        label: vehicle.vehicle?.label,
        lat: vehicle.position?.latitude,
        lon: vehicle.position?.longitude,
        bearing: vehicle.position?.bearing,
        speed: vehicle.position?.speed,
        route_id: vehicle.trip?.routeId,
        trip_id: vehicle.trip?.tripId,
        ts: Date.now()
      })
    }
  }
}

// Heartbeat
setInterval(() => {
  const msg = JSON.stringify({ type: 'heartbeat', ts: Date.now(), connected_clients: wss.clients.size })
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg)
  })
}, 30_000)

console.log('WS server running on ws://localhost:3000')
```

### Запуск

```bash
npm install ws
node server.js
```

### С Redis pub/sub (горизонтальное масштабирование)

```javascript
const redis = require('redis')
const subscriber = redis.createClient()

subscriber.subscribe('gtfs-rt-events', (message) => {
  const event = JSON.parse(message)
  broadcast(event)
})

// Публикатор (отдельный процесс GTFS-RT адаптера):
const publisher = redis.createClient()
publisher.publish('gtfs-rt-events', JSON.stringify({
  type: 'arrival',
  stop_id: 'stop_123',
  ...
}))
```

---

## 9. Тестирование без сервера

### Встроенный симулятор (React)

Файл: `src/realtime/vehicleTracker.js`

По умолчанию `startVehicleTracker(null)` запускает симулятор без WebSocket.

**Алгоритм:**

```javascript
// 1. Взять до 30 маршрутов из store
// 2. Разместить ТС по кругу вокруг PKC (158.7, 53.015)
// 3. Каждые 2 сек обновлять lon/lat с bounce внутри bbox
// 4. useAppStore.setState({ vehicles: [...simVehicles] })
```

При заданном `wsUrl` — подключение к WS; если за 10 сек нет данных, fallback на симулятор.

### Legacy-симулятор (`app.html`)

Генерирует ETA-события (`arrival`) и позиции ТС на основе `stopTimesArr` и `getVehiclePos()`. Подробнее — git-история `public/app.html`.

### Тестирование через wscat

```bash
npm install -g wscat

# Подключение
wscat -c ws://localhost:3000/transit/ws

# Подписка
> {"action":"subscribe","stops":["stop_260328_80828"],"routes":["route_260328_42721"]}

# Получение событий
< {"type":"arrival","stop_id":"stop_260328_80828","eta":180,...}
< {"type":"vehicle","id":"vehicle_01","lat":53.07,"lon":158.60,...}
```

### Тестовые данные (fixtures)

```javascript
// Тестовые события для локальной разработки
const MOCK_EVENTS = [
  { type:'arrival', stop_id:'stop_260328_80828', route_id:'route_260328_42721',
    eta:180, scheduled_eta:240, delay:-60, vehicle_id:'v1', ts:Date.now() },
  { type:'vehicle', id:'v1', lat:53.0702, lon:158.6035, bearing:275, speed:9.2,
    route_id:'route_260328_42721', ts:Date.now() },
  { type:'alert', id:'a1', severity:2, title:'ДТП', text:'ул. Ленинская',
    impact:'Задержки ~8 мин', routes_affected:['route_260328_42721'], ts:Date.now() }
]
```

---

## 10. Масштабирование

### Топология (один датацентр)

```
              ┌─────────────┐
              │  Load Balancer │
              │  (nginx/HAProxy)│
              └──────┬──────┘
                     │ WebSocket sticky sessions
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │ WS Node1│ │ WS Node2│ │ WS Node3│
    └─────────┘ └─────────┘ └─────────┘
         │           │           │
         └───────────┼───────────┘
                     ▼
              ┌─────────────┐
              │    Redis    │ ← pub/sub для событий
              │  pub/sub    │ ← хранение snapshot
              └─────────────┘
                     ▲
              ┌─────────────┐
              │ GTFS-RT     │
              │ Adapter     │
              │ (protobuf)  │
              └─────────────┘
```

### Метрики нагрузки

| Параметр | Значение |
|---------|---------|
| Максимум подписок на клиент | 50 остановок + 20 маршрутов |
| Частота событий | 1 событие / 5–15 сек на ТС |
| Событий в секунду (12 ТС) | ~1–2 |
| Подключений на сервер | до 10 000 (Node.js) |
| Пропускная способность | ~100 КБ/с при 1000 клиентах |

### Rate Limiting

```
Подключений с одного IP: 5
Сообщений в минуту: 100
Подписок на сессию: 70 (50 stops + 20 routes)
```
