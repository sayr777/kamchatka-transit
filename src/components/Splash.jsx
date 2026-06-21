import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { t } from '../i18n';
import styles from './Splash.module.css';

const LANGS = [
  { code: 'ru', flag: '/flags/ru.svg', name: 'Русский',  native: 'Russian'   },
  { code: 'en', flag: '/flags/en.svg', name: 'English',  native: 'Английский' },
  { code: 'zh', flag: '/flags/zh.svg', name: '中文',     native: 'Китайский'  },
  { code: 'ja', flag: '/flags/ja.svg', name: '日本語',   native: 'Японский'   },
];

const FEATURES = [
  { icon: '📡', key: 'splash.f.realtime' },
  { icon: '🗓', key: 'splash.f.schedule' },
  { icon: '✈️', key: 'splash.f.offline'  },
];

const APP_NAMES = { ru: 'Камчатка.Транспорт', en: 'Kamchatka Transit', zh: '堪察加交通', ja: 'カムチャツカ交通' };

export default function Splash() {
  const setLang   = useAppStore((s) => s.setLang);
  const setSplash = useAppStore((s) => s.setSplash);
  const [selected, setSelected] = useState(useAppStore.getState().lang || 'ru');

  const handleStart = () => {
    setLang(selected);
    setSplash(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.hero}>
        <div className={styles.title}>{APP_NAMES[selected] ?? APP_NAMES.ru}</div>
        <div className={styles.features}>
          {FEATURES.map((f) => (
            <div key={f.key} className={styles.featureItem}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <span className={styles.featureText}>{t(f.key, selected)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.sub}>{t('splash.subtitle', selected)}</div>
        <div className={styles.langs}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`${styles.lang} ${selected === l.code ? styles.selected : ''}`}
              onClick={() => setSelected(l.code)}
              aria-pressed={selected === l.code}
              aria-label={l.name}
              title={l.name}
            >
              <img
                className={styles.flagImg}
                src={l.flag}
                alt=""
                width={44}
                height={30}
                draggable={false}
              />
              <span className={styles.langText}>
                <span className={styles.langName}>{l.name}</span>
                <span className={styles.langNative}>{l.native}</span>
              </span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.start} onClick={handleStart}>
          {t('splash.continue', selected)}
        </button>
      </div>
    </div>
  );
}