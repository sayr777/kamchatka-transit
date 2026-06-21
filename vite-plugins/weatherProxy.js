/**
 * Прокси + серверный кэш для бесплатного тарифа «Погода на вашем сайте».
 * Лимит API: 50 запросов/сутки на ключ — кэш 1 ч ≈ 24 запроса/сутки.
 */

import { loadEnv } from 'vite';
import { isValidWeatherKey } from '../src/weather/weatherConfig.js';

const YANDEX_URL = 'https://api.weather.yandex.ru/v2/informers';
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map();

async function fetchFromYandex(lat, lon, lang, apiKey) {
  const url = `${YANDEX_URL}?lat=${lat}&lon=${lon}&lang=${lang}`;
  const res = await fetch(url, {
    headers: { 'X-Yandex-Weather-Key': apiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Yandex ${res.status}: ${text.slice(0, 120)}`);
  }
  return res.json();
}

function readWeatherKey(mode) {
  const env = loadEnv(mode, process.cwd(), '');
  return env.YANDEX_WEATHER_KEY || process.env.YANDEX_WEATHER_KEY || '';
}

async function handleWeatherRequest(req, res, mode) {
  const apiKey = readWeatherKey(mode);
  if (!apiKey || !isValidWeatherKey(apiKey)) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'YANDEX_WEATHER_KEY not set' }));
    return;
  }

  const { searchParams } = new URL(req.url, 'http://localhost');
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const lang = searchParams.get('lang') || 'ru_RU';

  if (!lat || !lon) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'lat and lon required' }));
    return;
  }

  const cacheKey = `${lat}:${lon}:${lang}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Weather-Cache', 'HIT');
    res.end(JSON.stringify(hit.data));
    return;
  }

  try {
    const data = await fetchFromYandex(lat, lon, lang, apiKey);
    cache.set(cacheKey, { data, ts: Date.now() });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Weather-Cache', 'MISS');
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error('[weather-proxy]', e.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}

function attachMiddleware(server) {
  const mode = server.config?.mode || 'development';
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/api/weather')) return next();
    handleWeatherRequest(req, res, mode);
  });
}

export function weatherProxyPlugin() {
  return {
    name: 'weather-proxy-cache',
    config(_, { mode }) {
      const ready = isValidWeatherKey(readWeatherKey(mode));
      return {
        define: {
          'import.meta.env.VITE_WEATHER_PROXY_READY': JSON.stringify(ready ? 'true' : 'false'),
        },
      };
    },
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  };
}