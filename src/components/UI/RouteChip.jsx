import React from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import pill from './topPill.module.css';
import styles from './RouteChip.module.css';
import Tooltip from './Tooltip';

export default function RouteChip() {
  const t = useT();
  const route = useAppStore((s) => s.route);
  const clearRoute = useAppStore((s) => s.clearRoute);
  const closePopup = useAppStore((s) => s.closePopup);
  const favoriteRouteIds = useAppStore((s) => s.favoriteRouteIds);
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute);
  const setChip = useAppStore((s) => s.setChip);

  if (!route) return null;

  const shortName = route.meta?.shortName || route.id;
  const color = route.meta?.hex || '#FC3F1D';

  const isFavorite = favoriteRouteIds.includes(route.id);

  const handleClear = (e) => {
    e.stopPropagation();
    closePopup();
    clearRoute();
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    const added = toggleFavoriteRoute(route.id);
    setChip(t(added ? 'favorites.route_added' : 'favorites.route_removed'), 2000);
  };

  return (
    <div className={styles.wrap}>
      <div
        className={`${pill.pill} ${styles.pill}`}
        role="status"
        aria-label={`${t('route.label')} ${shortName}`}
      >
        <span className={styles.badge} style={{ background: color }} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="11" rx="2" />
            <path d="M7 17v2M17 17v2M5 11h14" />
          </svg>
        </span>
        <span className={styles.num}>{shortName}</span>
        <Tooltip
          label={t(isFavorite ? 'favorites.remove_route' : 'favorites.add_route')}
          side="bottom"
        >
          <button
            type="button"
            className={`${styles.fav} ${isFavorite ? styles.favOn : ''}`}
            onClick={handleFavorite}
            aria-label={t(isFavorite ? 'favorites.remove_route' : 'favorites.add_route')}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </Tooltip>
        <Tooltip label={t('route.clear')} side="bottom">
          <button
            type="button"
            className={styles.close}
            onClick={handleClear}
            aria-label={t('route.clear')}
          >
            ✕
          </button>
        </Tooltip>
      </div>
    </div>
  );
}