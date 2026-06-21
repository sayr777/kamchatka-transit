# Документация — Камчатка.Транспорт

Офлайн PWA для общественного транспорта Петропавловска-Камчатского.

## Быстрые ссылки

| Документ | Описание |
|----------|----------|
| [../README.md](../README.md) | Главный README: старт, стек, команды |
| [CHANGELOG.md](CHANGELOG.md) | Аудит изменений (июнь 2026) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Архитектура React-приложения |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Сборка, деплой, PWA, WS-сервер |
| [USER_GUIDE.md](USER_GUIDE.md) | Руководство пользователя |
| [APP_DESCRIPTION.md](APP_DESCRIPTION.md) | UX-спецификация экранов |
| [BACKLOG.md](BACKLOG.md) | Бэклог миграции legacy → React |

## Данные и API

| Документ | Описание |
|----------|----------|
| [GTFS_EXTENSIONS.md](GTFS_EXTENSIONS.md) | vehicles.txt, vehicle_trips.txt |
| [WEBSOCKET_API.md](WEBSOCKET_API.md) | Протокол реалтайм WebSocket |
| [OSM_GTFS_ROUTING_SERVICE.md](OSM_GTFS_ROUTING_SERVICE.md) | Будущий routing-сервис |

## Дизайн и бренд

| Документ | Описание |
|----------|----------|
| [BRANDBOOK.md](BRANDBOOK.md) | Дизайн-система, токены, UX |
| [BRANDING.md](BRANDING.md) | Названия на 4 языках |
| [I18N_IMPLEMENTATION.md](I18N_IMPLEMENTATION.md) | Мультиязычность |
| [TOURISM_LANGUAGE_ANALYSIS.md](TOURISM_LANGUAGE_ANALYSIS.md) | Языковая стратегия для туристов |

## Версии приложения

| Версия | Путь | Запуск |
|--------|------|--------|
| **React (основная)** | `src/` | `npm run dev` |
| **Legacy** | `public/app.html` | `python -m http.server 8000 -d public` |

Актуальность документов: **июнь 2026**.