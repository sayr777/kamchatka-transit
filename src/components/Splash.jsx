import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import styles from './Splash.module.css';

const LANGS = [
  { code: 'ru', flag: '🇷🇺', name: 'Русский',  native: 'Russian'    },
  { code: 'en', flag: '🇬🇧', name: 'English',  native: 'Английский' },
  { code: 'zh', flag: '🇨🇳', name: '中文',     native: 'Китайский'  },
  { code: 'ja', flag: '🇯🇵', name: '日本語',   native: 'Японский'   },
];

export default function Splash() {
  const setLang    = useAppStore((s) => s.setLang);
  const setSplash  = useAppStore((s) => s.setSplash);
  const currentLang = useAppStore((s) => s.lang);
  const [selected, setSelected] = useState(currentLang || 'ru');

  const handleStart = () => {
    setLang(selected);
    setSplash(false);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.hero}>
        <div className={styles.title}>Камчатка.Транспорт</div>
        <div className={styles.sub}>Выберите язык интерфейса перед началом работы</div>
      </div>
      <div className={styles.card}>
        <div className={styles.langs}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              className={`${styles.lang} ${selected === l.code ? styles.selected : ''}`}
              onClick={() => setSelected(l.code)}
            >
              <span className={styles.flag}>{l.flag}</span>
              <span className={styles.name}>{l.name}</span>
              <span className={styles.native}>{l.native}</span>
            </button>
          ))}
        </div>
        <button className={styles.start} onClick={handleStart}>
          Продолжить →
        </button>
      </div>
    </div>
  );
}
