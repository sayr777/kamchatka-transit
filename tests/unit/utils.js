/**
 * Чистые функции, извлечённые из index.html для юнит-тестирования.
 * Не имеют зависимостей от DOM или глобального состояния S.
 */

// ── Геометрия ─────────────────────────────────────────────────

/** Расстояние между двумя точками (lat/lon) в метрах по формуле Haversine */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Длина маршрута в км по массиву точек [[lon,lat], ...] */
export function routeLengthKm(path) {
  if (!path || path.length < 2) return 0;
  let meters = 0;
  for (let i = 1; i < path.length; i++) {
    meters += haversineMeters(path[i-1][1], path[i-1][0], path[i][1], path[i][0]);
  }
  return meters / 1000;
}

/** Азимут от точки a=[lon,lat] до b=[lon,lat] в градусах [0, 360) */
export function getBearing(a, b) {
  if (!a || !b) return 0;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}

/** Нормализация угла в диапазон [0, 360) */
export function normalizeBearing(value) {
  const bearing = Number.isFinite(value) ? value : 0;
  return ((bearing % 360) + 360) % 360;
}

// ── Камчатка ──────────────────────────────────────────────────

export const KAMCHATKA_BOUNDS = { latMin: 50.8, latMax: 60.5, lonMin: 155.0, lonMax: 167.0 };
export const PKC = { lon: 158.700, lat: 53.015 };

/** Проверяет, находится ли точка в пределах Камчатского края */
export function isOnKamchatka(lat, lon) {
  return lat >= KAMCHATKA_BOUNDS.latMin && lat <= KAMCHATKA_BOUNDS.latMax &&
         lon >= KAMCHATKA_BOUNDS.lonMin && lon <= KAMCHATKA_BOUNDS.lonMax;
}

// ── Время ─────────────────────────────────────────────────────

/** Разбирает время вида "HH:MM[:SS]" в минуты от полуночи */
export function parseTimeMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Форматирует время "HH:MM:SS" → "HH:MM" */
export function formatTime(t) {
  if (!t) return '';
  const p = t.split(':');
  return p[0] + ':' + p[1];
}

/** Дата в формате GTFS YYYYMMDD */
export function toGtfsDate(d) {
  return d.getFullYear().toString() +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0');
}

// ── Строки / цвета ────────────────────────────────────────────

/** Нормализует имя остановки для поиска (lowercase, ё→е, без кавычек) */
export function normalizeName(s) {
  return String(s || '').toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/["«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Хэш строки в неотрицательное целое */
export function hashString(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Экранирование HTML-спецсимволов */
export function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** HEX-цвет → [r, g, b] */
export function hexRgb(hex) {
  return (hex.replace('#', '')).match(/.{2}/g).map(x => parseInt(x, 16));
}

/** Тип маршрута GTFS → читаемое название */
export function routeTypeLabel(v) {
  const type = parseInt(String(v?.route_type ?? v ?? ''));
  return { 0: 'Трамвай', 1: 'Метро', 2: 'Поезд', 3: 'Автобус', 11: 'Троллейбус', 12: 'Монорельс' }[type] || 'Транспорт';
}

/** Булево поле GTFS (0/1/пусто) → читаемое значение */
export function boolLabel(value) {
  return String(value) === '1' ? 'Да' : String(value) === '0' ? 'Нет' : 'Нет данных';
}

// ── Анимация ──────────────────────────────────────────────────

/** Линейная интерполяция */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Интерполяция угла с учётом перехода через 360° */
export function lerpAngle(from, to, t) {
  const delta = ((((to - from) + 540) % 360) - 180);
  return (from + delta * t + 360) % 360;
}

/** Кратчайшая разность в кольцевом пространстве */
export function shortestLoopDelta(from, to, loop) {
  let delta = ((to - from) % loop + loop) % loop;
  if (delta > loop / 2) delta -= loop;
  return delta;
}

/** Коэффициент сглаживания для экспоненциального фильтра */
export function dampFactor(deltaMs, smoothingMs) {
  const safe = Math.max(1, smoothingMs || 1);
  return 1 - Math.exp(-Math.max(0, deltaMs) / safe);
}

/** Детерминированный цвет маршрута по числовому seed (HEX) */
export function getPaletteRouteHex(seed) {
  const PALETTE = [
    '#E53935','#D81B60','#8E24AA','#3949AB','#1E88E5',
    '#039BE5','#00ACC1','#00897B','#43A047','#7CB342',
    '#F4511E','#FB8C00','#F4B400','#6D4C41','#546E7A',
  ];
  return PALETTE[seed % PALETTE.length];
}
