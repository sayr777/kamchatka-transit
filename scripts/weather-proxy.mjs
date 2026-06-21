#!/usr/bin/env node
/**
 * Standalone-прокси погоды для продакшна (рядом со статикой).
 * Лимит бесплатного тарифа Яндекса: 50 req/день — кэш 1 ч.
 *
 * Запуск:
 *   YANDEX_WEATHER_KEY=xxx node scripts/weather-proxy.mjs
 * Nginx: location /api/weather { proxy_pass http://127.0.0.1:8787; }
 */

import http from 'http';

const PORT = Number(process.env.WEATHER_PROXY_PORT || 8787);
const KEY = process.env.YANDEX_WEATHER_KEY;
const YANDEX_URL = 'https://api.weather.yandex.ru/v2/informers';
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

if (!KEY) {
  console.error('YANDEX_WEATHER_KEY is required');
  process.exit(1);
}

async function fetchYandex(lat, lon, lang) {
  const url = `${YANDEX_URL}?lat=${lat}&lon=${lon}&lang=${lang}`;
  const res = await fetch(url, { headers: { 'X-Yandex-Weather-Key': KEY } });
  if (!res.ok) throw new Error(`Yandex HTTP ${res.status}`);
  return res.json();
}

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith('/api/weather')) {
    res.writeHead(404); res.end(); return;
  }

  const { searchParams } = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const lang = searchParams.get('lang') || 'ru_RU';

  if (!lat || !lon) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'lat and lon required' }));
    return;
  }

  const cacheKey = `${lat}:${lon}:${lang}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Weather-Cache': 'HIT' });
    res.end(JSON.stringify(hit.data));
    return;
  }

  try {
    const data = await fetchYandex(lat, lon, lang);
    cache.set(cacheKey, { data, ts: Date.now() });
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Weather-Cache': 'MISS' });
    res.end(JSON.stringify(data));
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`[weather-proxy] http://127.0.0.1:${PORT}/api/weather`);
});