import { useAppStore } from '../store/appStore';
import { fetchYandexWeather, isWeatherConfigured, LANG_MAP } from './yandexWeather';

/** Петропавловск-Камчатский — одна точка для бесплатного тарифа (50 req/день на ключ). */
const PKC = { lat: 53.015, lon: 158.700 };
const REFRESH_MS = 60 * 60 * 1000;

let timer = null;
let inflight = null;
let unsub = null;

function apiLang() {
  const { lang } = useAppStore.getState();
  return LANG_MAP[lang] || 'ru_RU';
}

async function loadWeather(force = false) {
  if (!isWeatherConfigured()) {
    useAppStore.setState({ weather: null, weatherStatus: 'unconfigured' });
    return;
  }

  const { lat, lon } = PKC;
  const lang = apiLang();
  useAppStore.setState({ weatherStatus: 'loading' });

  try {
    if (inflight) await inflight;
    inflight = fetchYandexWeather(lat, lon, { force, lang });
    const data = await inflight;
    useAppStore.setState({ weather: data, weatherStatus: 'ready', weatherError: null });
  } catch (e) {
    console.warn('[Weather]', e.message);
    useAppStore.setState({
      weather: null,
      weatherStatus: 'error',
      weatherError: e.message,
      weatherDisabled: false,
    });
  } finally {
    inflight = null;
  }
}

export function startWeatherSync() {
  stopWeatherSync();
  loadWeather();
  timer = setInterval(() => loadWeather(true), REFRESH_MS);

  unsub = useAppStore.subscribe((state, prev) => {
    if (state.lang !== prev.lang) loadWeather(true);
  });

  return stopWeatherSync;
}

export function stopWeatherSync() {
  if (timer) { clearInterval(timer); timer = null; }
  if (unsub) { unsub(); unsub = null; }
}

export function refreshWeather() {
  return loadWeather(true);
}