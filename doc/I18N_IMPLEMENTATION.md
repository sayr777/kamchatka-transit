# Реализация мультиязычности в Transit PWA

> Актуально для React-версии. Реализация: `src/i18n.js`.

## Статус

| Приоритет | Языки | Статус |
|-----------|-------|--------|
| P0 | RU, EN | ✅ UI переведён |
| P1 | ZH, JA | ✅ UI переведён |
| P2 | Корякский, ительменский | 📋 План (см. `TOURISM_LANGUAGE_ANALYSIS.md`) |

Языковые GTFS-фиды: отдельные ZIP (`gtfs_ru.zip`, `gtfs_en.zip`, `gtfs_cn.zip`, `gtfs_jp.zip`).  
Сборка: `npm run build:gtfs` → `scripts/build-gtfs-langs.mjs`. Тесты: `tests/unit/gtfs-i18n.test.js`.

---

## Архитектура

### Модуль переводов

Файл: `src/i18n.js`

```javascript
const T = {
  ru: { 'splash.subtitle': '...', 'panel.tab.stops': '...', ... },
  en: { ... },
  zh: { ... },
  ja: { ... },
};

export function t(key, lang) { ... }      // функция перевода
export function useT() { ... }            // React-хук (подписка на lang из store)
```

### Хранение языка

```javascript
// src/store/appStore.js
lang: localStorage.getItem('kamchatka.transport.lang') || 'ru',
setLang: (lang) => {
  localStorage.setItem('kamchatka.transport.lang', lang);
  set({ lang });
},
splash: !localStorage.getItem('kamchatka.transport.lang'),
```

При первом запуске `splash === true` → экран выбора языка (`Splash.jsx`).

### Fallback-цепочка

```
selected lang → ru → key (как есть)
```

---

## Что переводится

- Экран Splash (подзаголовок, кнопки, фичи)
- Вкладки панели (остановки / маршруты)
- Пустые состояния списков
- Карточка остановки (заголовки, кнопки)
- FAB-кнопки (title, aria-label)
- Toast-уведомления (Chip)
- Сообщения об ошибках

## GTFS-переводы

Названия остановок, маршрутов и агентств берутся из **языкового архива**, соответствующего языку интерфейса. Переводы генерируются скриптом `build-gtfs-langs.mjs` на основе `gtfs-translations.mjs`. Коды остановок (`stop_id`) не переводятся.

Каталоги: `public/gtfs/` (ru), `gtfs_en/`, `gtfs_zh/`, `gtfs_ja/`.

---

## Использование в компонентах

```jsx
import { useT } from '../../i18n';

export default function MyComponent() {
  const t = useT();
  return <span>{t('panel.tab.stops')}</span>;
}
```

Вне React (например, `vehicleTracker.js`):

```javascript
import { t } from '../i18n';
useAppStore.getState().setChip(t('rt.connected', lang), 2000);
```

---

## Ключи переводов (текущий набор)

| Ключ | RU | EN |
|------|----|----|
| `splash.subtitle` | Выберите язык… | Choose language… |
| `splash.continue` | Продолжить | Continue |
| `panel.tab.stops` | Остановки | Stops |
| `panel.tab.routes` | Маршруты | Routes |
| `stop.upcoming` | Ближайшие рейсы | Upcoming trips |
| `stop.show_route` | Показать маршрут на карте | Show route on map |
| `search.placeholder` | Маршрут или остановка… | Route or stop… |
| `locate.title` | Моё местоположение | My location |
| `planner.title` | Планировщик маршрутов | Route planner |
| `error.gtfs` | Ошибка загрузки данных | Failed to load data |

Полный список — в `src/i18n.js`.

---

## Смена языка

1. Пользователь нажимает кнопку глобуса (`FeedButton`)
2. `setSplash(true)` → экран Splash
3. Выбор языка → `setLang(lang)` + `setSplash(false)`
4. `App.jsx` перезагружает GTFS: `loadGtfsFeed(lang)`

---

## Добавление нового языка

1. Добавить блок в `T` в `src/i18n.js`
2. Добавить кнопку с флагом в `Splash.jsx` + `public/flags/XX.svg`
3. Добавить URL в `FEEDS` в `src/gtfs/loader.js`
4. Добавить переводы в `scripts/gtfs-translations.mjs`, выполнить `npm run build:gtfs`
5. Обновить `doc/BRANDING.md`

---

## UX-рекомендации

- Переключатель языка — кнопка глобуса (всегда доступна)
- Не менять язык GTFS-данных без явного выбора пользователя
- На Splash показывать ключевые фичи на выбранном языке
- Для туристов: EN/ZH/JA на первом экране (см. `TOURISM_LANGUAGE_ANALYSIS.md`)

---

## Legacy

В `public/app.html` переводы встроены в монолит (объект `I18N`). При миграции ключи унифицируются с `src/i18n.js`.