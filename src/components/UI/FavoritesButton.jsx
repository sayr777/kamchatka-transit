import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import styles from './fab.module.css';
import css from './FavoritesButton.module.css';
import Tooltip from './Tooltip';

export default function FavoritesButton({ onOpen }) {
  const t = useT();
  const count = useAppStore((s) => s.favoriteStopIds.length + s.favoriteRouteIds.length);

  return (
    <Tooltip label={t('panel.tab.favorites')}>
      <button
        id="favorites-btn"
        className={`${styles.fab} ${css.favorites}`}
        aria-label={t('panel.tab.favorites')}
        onClick={() => onOpen?.()}
      >
        <span className={css.icon} aria-hidden="true">★</span>
        {count > 0 && <span className={css.badge}>{count > 9 ? '9+' : count}</span>}
      </button>
    </Tooltip>
  );
}