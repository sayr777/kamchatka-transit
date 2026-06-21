/**
 * Yandex Weather — бесплатный тариф «Погода на вашем сайте».
 * REST: GET /v2/informers?lat=&lon=&lang=
 * Лимит: 50 запросов/сутки на ключ → используйте /api/weather с серверным кэшем.
 */

import {
  getClientWeatherKey,
  isWeatherConfigured,
  isWeatherSetupError,
  useWeatherProxy,
} from './weatherConfig.js';

export { isWeatherConfigured, isWeatherSetupError } from './weatherConfig.js';

const DIRECT_URL = 'https://api.weather.yandex.ru/v2/informers';
const CACHE_NAME = 'yandex-weather-v2';
const CLIENT_CACHE_TTL_MS = 60 * 60 * 1000;

export const LANG_MAP = {
  ru: 'ru_RU',
  en: 'en_US',
  zh: 'en_US',
  ja: 'en_US',
};

function getProxyPath() {
  return import.meta.env.VITE_WEATHER_PROXY || '/api/weather';
}

function cacheKey(lat, lon, lang) {
  return `weather:${lat.toFixed(3)}:${lon.toFixed(3)}:${lang}`;
}

async function readCache(lat, lon, lang) {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(cacheKey(lat, lon, lang));
    if (!res) return null;
    const { data, ts } = await res.json();
    if (Date.now() - ts > CLIENT_CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeCache(lat, lon, lang, data) {
  if (!('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      cacheKey(lat, lon, lang),
      new Response(JSON.stringify({ data, ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    );
  } catch {}
}

export function normalizeInformer(json, lat, lon) {
  const fact = json?.fact;
  if (!fact) return null;
  const icon = fact.icon || null;
  return {
    lat: json.info?.lat ?? lat,
    lon: json.info?.lon ?? lon,
    temperature: fact.temp ?? null,
    feelsLike: fact.feels_like ?? null,
    humidity: fact.humidity ?? null,
    pressure: fact.pressure_mm ?? null,
    windSpeed: fact.wind_speed ?? null,
    windDirection: fact.wind_dir ?? null,
    condition: fact.condition ?? null,
    icon,
    iconUrl: icon
      ? `https://yastatic.net/weather/i/icons/funky/dark/${icon}.svg`
      : null,
    infoUrl: json.info?.url || 'https://yandex.ru/pogoda',
    updatedAt: Date.now(),
    source: 'yandex-informer',
  };
}

function buildUrl(lat, lon, lang) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    lang,
  });
  if (useWeatherProxy()) {
    return `${getProxyPath()}?${params}`;
  }
  return `${DIRECT_URL}?${params}`;
}

/**
 * @param {number} lat
 * @param {number} lon
 * @param {{ force?: boolean, lang?: string }} [opts]
 */
export async function fetchYandexWeather(lat, lon, opts = {}) {
  const lang = opts.lang || 'ru_RU';

  if (!opts.force) {
    const cached = await readCache(lat, lon, lang);
    if (cached) return cached;
  }

  const proxyMode = useWeatherProxy();
  const apiKey = getClientWeatherKey();

  if (!proxyMode && !apiKey) {
    throw new Error('YANDEX_WEATHER_KEY_MISSING');
  }

  const headers = {};
  if (!proxyMode && apiKey) {
    headers['X-Yandex-Weather-Key'] = apiKey;
  }

  const res = await fetch(buildUrl(lat, lon, lang), { headers });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error || '';
    } catch {}
    const err = new Error(`YANDEX_WEATHER_HTTP_${res.status}${detail ? `: ${detail}` : ''}`);
    if (isWeatherSetupError(err.message)) err.code = 'WEATHER_UNCONFIGURED';
    throw err;
  }

  const json = await res.json();
  if (json.error) {
    const err = new Error(json.error);
    if (isWeatherSetupError(json.error)) err.code = 'WEATHER_UNCONFIGURED';
    throw err;
  }

  const data = normalizeInformer(json, lat, lon);
  if (!data) throw new Error('YANDEX_WEATHER_EMPTY');

  await writeCache(lat, lon, lang, data);
  return data;
}