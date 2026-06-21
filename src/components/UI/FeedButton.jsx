import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import styles from './fab.module.css';
import css from './FeedButton.module.css';
import Tooltip from './Tooltip';

export default function FeedButton() {
  const t = useT();
  const setSplash = useAppStore((s) => s.setSplash);
  return (
    <Tooltip label={t('lang.title')}>
      <button
        id="feed-btn"
        className={`${styles.fab} ${css.feed}`}
        aria-label={t('lang.title')}
        onClick={() => setSplash(true)}
      >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20M12 2a14.5 14.5 0 0 1 0 20"/>
        <path d="M2 12h20"/>
      </svg>
      </button>
    </Tooltip>
  );
}
