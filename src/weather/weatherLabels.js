/** Иконка-эмодзи (fallback, если нет iconUrl от Яндекса) */
export function weatherIcon(weather) {
  if (!weather) return '🌡';
  const c = weather.condition;
  if (c?.includes('snow')) return '❄️';
  if (c?.includes('rain') || c === 'drizzle' || c === 'showers') return '🌧';
  if (c?.includes('thunder')) return '⛈';
  if (c === 'hail') return '🌨';
  if (c === 'clear') return '☀️';
  if (c === 'partly-cloudy') return '⛅';
  if (c === 'cloudy' || c === 'overcast') return '☁️';
  return '🌤';
}

const WIND = {
  n: 'weather.wind.N',
  ne: 'weather.wind.NE',
  e: 'weather.wind.E',
  se: 'weather.wind.SE',
  s: 'weather.wind.S',
  sw: 'weather.wind.SW',
  w: 'weather.wind.W',
  nw: 'weather.wind.NW',
  c: 'weather.wind.calm',
};

const CONDITION = {
  'clear': 'weather.cloud.clear',
  'partly-cloudy': 'weather.cloud.partly',
  'cloudy': 'weather.cloud.significant',
  'overcast': 'weather.cloud.overcast',
  'drizzle': 'weather.prec.drizzle',
  'light-rain': 'weather.prec.light-rain',
  'rain': 'weather.prec.rain',
  'moderate-rain': 'weather.prec.rain',
  'heavy-rain': 'weather.prec.heavy-rain',
  'continuous-heavy-rain': 'weather.prec.heavy-rain',
  'showers': 'weather.prec.rain',
  'wet-snow': 'weather.prec.mixed',
  'light-snow': 'weather.prec.snow',
  'snow': 'weather.prec.snow',
  'snow-showers': 'weather.prec.snow',
  'hail': 'weather.prec.hail',
  'thunderstorm': 'weather.prec.thunderstorm',
  'thunderstorm-with-rain': 'weather.prec.thunderstorm',
  'thunderstorm-with-hail': 'weather.prec.thunderstorm',
};

export function weatherConditionKey(weather) {
  if (!weather?.condition) return 'weather.unknown';
  return CONDITION[weather.condition] || 'weather.unknown';
}

export function windDirectionKey(dir) {
  if (!dir) return 'weather.wind.unknown';
  return WIND[String(dir).toLowerCase()] || 'weather.wind.unknown';
}