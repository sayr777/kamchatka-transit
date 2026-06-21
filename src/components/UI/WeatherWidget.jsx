import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import { refreshWeather } from '../../weather/weatherSync';
import { isWeatherConfigured, isWeatherSetupError } from '../../weather/yandexWeather';
import { weatherIcon, weatherConditionKey, windDirectionKey } from '../../weather/weatherLabels';
import styles from './WeatherWidget.module.css';
import Tooltip from './Tooltip';

function WeatherGlyph({ weather }) {
  if (weather?.iconUrl) {
    return <img src={weather.iconUrl} alt="" className={styles.yandexIcon} width={24} height={24} />;
  }
  return <span className={styles.icon} aria-hidden="true">{weatherIcon(weather)}</span>;
}

export default function WeatherWidget() {
  const t = useT();
  const weather = useAppStore((s) => s.weather);
  const status = useAppStore((s) => s.weatherStatus);
  const weatherError = useAppStore((s) => s.weatherError);
  const [open, setOpen] = useState(false);

  if (!isWeatherConfigured()) return null;

  const temp = weather?.temperature;
  const tempLabel = temp != null ? `${temp > 0 ? '+' : ''}${temp}°` : '—';
  const infoUrl = weather?.infoUrl || 'https://yandex.ru/pogoda';

  const handleRefresh = (e) => {
    e.stopPropagation();
    refreshWeather();
  };

  return (
    <div className={styles.wrap}>
      <Tooltip label={t('weather.title')} side="bottom">
        <button
          type="button"
          className={styles.pill}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t('weather.title')}
        >
          <WeatherGlyph weather={weather} />
          <span className={styles.temp}>{status === 'loading' && !weather ? '…' : tempLabel}</span>
          {weather && (
            <span className={styles.cond}>{t(weatherConditionKey(weather))}</span>
          )}
        </button>
      </Tooltip>

      {open && (
        <div className={styles.card} role="dialog" aria-label={t('weather.details')}>
          <div className={styles.cardHead}>
            <span className={styles.cardIconWrap}>
              <WeatherGlyph weather={weather} />
            </span>
            <div>
              <div className={styles.cardTemp}>{tempLabel}</div>
              <div className={styles.cardCond}>
                {weather ? t(weatherConditionKey(weather)) : t('weather.loading')}
              </div>
              {weather?.feelsLike != null && (
                <div className={styles.feelsLike}>
                  {t('weather.feels_like')}: {weather.feelsLike > 0 ? '+' : ''}{weather.feelsLike}°
                </div>
              )}
            </div>
            <Tooltip label={t('weather.refresh')} side="top">
              <button
                type="button"
                className={styles.refresh}
                onClick={handleRefresh}
                aria-label={t('weather.refresh')}
              >
                ↻
              </button>
            </Tooltip>
          </div>

          {weather && (
            <dl className={styles.stats}>
              {weather.windSpeed != null && (
                <>
                  <dt>{t('weather.wind')}</dt>
                  <dd>{weather.windSpeed} {t('weather.wind.unit')} {t(windDirectionKey(weather.windDirection))}</dd>
                </>
              )}
              {weather.humidity != null && (
                <>
                  <dt>{t('weather.humidity')}</dt>
                  <dd>{weather.humidity}%</dd>
                </>
              )}
              {weather.pressure != null && (
                <>
                  <dt>{t('weather.pressure')}</dt>
                  <dd>{weather.pressure} {t('weather.pressure.unit')}</dd>
                </>
              )}
            </dl>
          )}

          {status === 'error' && (
            <p className={styles.error}>
              {isWeatherSetupError(weatherError) ? t('weather.error_setup') : t('weather.error')}
            </p>
          )}

          <a
            className={styles.attribution}
            href={infoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('weather.attribution')}
          </a>
        </div>
      )}
    </div>
  );
}