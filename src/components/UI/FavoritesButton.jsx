import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import styles from './fab.module.css';
import css from './FavoritesButton.module.css';
import Tooltip from './Tooltip';

export default function FavoritesButton({ active = false, onToggle }) {
  const t = useT();
  const count = useAppStore((s) => s.favoriteStopIds.length + s.favoriteRouteIds.length);

  return (
    <Tooltip label={t('panel.tab.favorites')}>
      <button
        id="favorites-btn"
        className={`${styles.fab} ${css.favorites} ${active ? styles.active : ''}`}
        aria-label={t('panel.tab.favorites')}
        aria-pressed={active}
        onClick={() => onToggle?.()}
      >
        <span className={css.icon} aria-hidden="true">★</span>
        {count > 0 && <span className={css.badge}>{count > 9 ? '9+' : count}</span>}
      </button>
    </Tooltip>
  );
}