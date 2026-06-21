import React, { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import { shortStopName } from '../../utils/stopFocus';
import pill from './topPill.module.css';
import styles from './RouteChip.module.css';
import stopStyles from './StopChip.module.css';
import Tooltip from './Tooltip';

export default function StopChip() {
  const t = useT();
  const stopFocus = useAppStore((s) => s.stopFocus);
  const activeStopId = useAppStore((s) => s.activeStopId);
  const allStops = useAppStore((s) => s.allStops);
  const clearStopFocus = useAppStore((s) => s.clearStopFocus);
  const closePopup = useAppStore((s) => s.closePopup);
  const favoriteStopIds = useAppStore((s) => s.favoriteStopIds);
  const toggleFavoriteStop = useAppStore((s) => s.toggleFavoriteStop);
  const setChip = useAppStore((s) => s.setChip);

  const stop = useMemo(() => {
    if (stopFocus?.stop) return stopFocus.stop;
    if (!activeStopId) return null;
    return allStops.find((s) => s.stop_id === activeStopId) ?? null;
  }, [stopFocus, activeStopId, allStops]);

  if (!stop) return null;
  const label = shortStopName(stop.stop_name || stop.name);
  const isFavorite = favoriteStopIds.includes(stop.stop_id);

  const handleClear = (e) => {
    e.stopPropagation();
    closePopup();
    clearStopFocus();
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    const added = toggleFavoriteStop(stop.stop_id);
    setChip(t(added ? 'favorites.stop_added' : 'favorites.stop_removed'), 2000);
  };

  return (
    <div className={stopStyles.wrap}>
      <div
        className={`${pill.pill} ${styles.pill}`}
        role="status"
        aria-label={`${t('stop.label')} ${label}`}
      >
        <span className={`${styles.badge} ${stopStyles.badge}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-6-5.2-6-9a6 6 0 1 1 12 0c0 3.8-6 9-6 9z" />
            <circle cx="12" cy="11" r="2" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <Tooltip label={stop.stop_name || stop.name} side="bottom">
          <span className={stopStyles.name}>{label}</span>
        </Tooltip>
        <Tooltip
          label={t(isFavorite ? 'favorites.remove_stop' : 'favorites.add_stop')}
          side="bottom"
        >
          <button
            type="button"
            className={`${styles.fav} ${isFavorite ? styles.favOn : ''}`}
            onClick={handleFavorite}
            aria-label={t(isFavorite ? 'favorites.remove_stop' : 'favorites.add_stop')}
          >
            {isFavorite ? '★' : '☆'}
          </button>
        </Tooltip>
        <Tooltip label={t('stop.clear')} side="bottom">
          <button
            type="button"
            className={styles.close}
            onClick={handleClear}
            aria-label={t('stop.clear')}
          >
            ✕
          </button>
        </Tooltip>
      </div>
    </div>
  );
}