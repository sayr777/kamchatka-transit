/** Проверка, что ключ Яндекс.Погоды задан и не является плейсхолдером. */
export function isValidWeatherKey(key) {
  if (!key || typeof key !== 'string') return false;
  const k = key.trim();
  if (k.length < 8) return false;
  if (/^your_/i.test(k) || k === 'your_api_key_here') return false;
  return true;
}

export function useWeatherProxy() {
  return import.meta.env.VITE_WEATHER_DIRECT !== 'true';
}

export function getClientWeatherKey() {
  return import.meta.env.VITE_YANDEX_WEATHER_KEY || '';
}

export function isProxyReadyAtBuild() {
  return import.meta.env.VITE_WEATHER_PROXY_READY === 'true';
}

/** Виджет включён по умолчанию (прокси-режим). Отключение: VITE_WEATHER_DISABLED=true. */
export function isWeatherConfigured() {
  if (import.meta.env.VITE_WEATHER_DISABLED === 'true') return false;
  if (import.meta.env.VITE_WEATHER_ENABLED === 'true') return true;

  const clientKey = getClientWeatherKey();
  if (!useWeatherProxy()) return isValidWeatherKey(clientKey);
  return true;
}

export function isWeatherSetupError(message) {
  if (!message) return false;
  return /HTTP_503|HTTP_404|KEY_MISSING|not set|KEY not set/i.test(message);
}