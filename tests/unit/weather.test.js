import { describe, it, expect, vi, afterEach } from 'vitest';
import { weatherIcon, weatherConditionKey, windDirectionKey } from '../../src/weather/weatherLabels.js';
import { normalizeInformer } from '../../src/weather/yandexWeather.js';
import {
  isValidWeatherKey,
  isWeatherConfigured,
  isWeatherSetupError,
} from '../../src/weather/weatherConfig.js';

describe('weatherLabels', () => {
  it('picks snow emoji', () => {
    expect(weatherIcon({ condition: 'snow' })).toBe('❄️');
  });

  it('picks clear emoji', () => {
    expect(weatherIcon({ condition: 'clear' })).toBe('☀️');
  });

  it('maps REST condition keys', () => {
    expect(weatherConditionKey({ condition: 'rain' })).toBe('weather.prec.rain');
    expect(weatherConditionKey({ condition: 'overcast' })).toBe('weather.cloud.overcast');
  });

  it('maps wind direction (REST lowercase)', () => {
    expect(windDirectionKey('nw')).toBe('weather.wind.NW');
    expect(windDirectionKey('c')).toBe('weather.wind.calm');
  });
});

describe('weatherConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects placeholder API keys', () => {
    expect(isValidWeatherKey('your_api_key_here')).toBe(false);
    expect(isValidWeatherKey('abc')).toBe(false);
    expect(isValidWeatherKey('a1b2c3d4e5f6g7h8')).toBe(true);
  });

  it('isWeatherConfigured is true in proxy mode by default', () => {
    vi.stubEnv('VITE_WEATHER_DISABLED', '');
    vi.stubEnv('VITE_WEATHER_DIRECT', '');
    expect(isWeatherConfigured()).toBe(true);
  });

  it('isWeatherConfigured is false when explicitly disabled', () => {
    vi.stubEnv('VITE_WEATHER_DISABLED', 'true');
    expect(isWeatherConfigured()).toBe(false);
  });

  it('detects setup errors', () => {
    expect(isWeatherSetupError('YANDEX_WEATHER_HTTP_503: YANDEX_WEATHER_KEY not set')).toBe(true);
    expect(isWeatherSetupError('YANDEX_WEATHER_HTTP_502')).toBe(false);
  });
});

describe('normalizeInformer', () => {
  it('parses Yandex v2 informers response', () => {
    const data = normalizeInformer({
      info: { lat: 53.01, lon: 158.7, url: 'https://yandex.ru/pogoda/petropavlovsk' },
      fact: {
        temp: -3,
        feels_like: -8,
        icon: 'ovc',
        condition: 'overcast',
        wind_speed: 5,
        wind_dir: 'nw',
        pressure_mm: 750,
        humidity: 80,
      },
    }, 53.015, 158.7);

    expect(data.temperature).toBe(-3);
    expect(data.feelsLike).toBe(-8);
    expect(data.condition).toBe('overcast');
    expect(data.windDirection).toBe('nw');
    expect(data.iconUrl).toContain('ovc.svg');
    expect(data.infoUrl).toContain('yandex.ru/pogoda');
  });
});