import React from 'react';
import { getRouteConditionTags, getStopConditionTags } from '../../utils/transportConditions';
import TransportTags from '../UI/TransportTags';
import styles from './Panel.module.css';

export function StopList({ stops, favoriteStopIds, onSelect, onToggleFavorite, t }) {
  if (!stops.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🚏</div>
        <div className={styles.emptyText}>{t('panel.empty.stops')}</div>
      </div>
    );
  }
  return stops.map((s) => {
    const isFav = favoriteStopIds.includes(s.stop_id);
    return (
      <div key={s.stop_id} className={styles.listItem}>
        <span className={styles.dot}>⬤</span>
        <div className={styles.itemInfo} onClick={() => onSelect(s)}>
          <div className={styles.itemName}>{s.stop_name}</div>
          <div className={styles.itemSub}>{s.stop_code || s.stop_id}</div>
          <TransportTags tags={getStopConditionTags(s, t)} />
        </div>
        <button
          type="button"
          className={`${styles.favToggle} ${isFav ? styles.favToggleOn : ''}`}
          aria-label={t(isFav ? 'favorites.remove_stop' : 'favorites.add_stop')}
          title={t(isFav ? 'favorites.remove_stop' : 'favorites.add_stop')}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(s); }}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>
    );
  });
}

export function RouteList({ routes, routeMeta, routeConditionsById, favoriteRouteIds, onSelect, onToggleFavorite, t }) {
  if (!routes.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🚌</div>
        <div className={styles.emptyText}>{t('panel.empty.routes')}</div>
      </div>
    );
  }
  return routes.map((r) => {
    const meta = routeMeta.get(r.route_id);
    const isFav = favoriteRouteIds.includes(r.route_id);
    return (
      <div key={r.route_id} className={styles.listItem}>
        <div className={styles.pill} style={{ background: meta?.hex || '#1e78d0' }} onClick={() => onSelect(r)}>
          {r.route_short_name || r.route_id}
        </div>
        <div className={styles.itemInfo} onClick={() => onSelect(r)}>
          <div className={styles.itemName}>{r.route_long_name || r.route_short_name}</div>
          <TransportTags tags={getRouteConditionTags(r.route_id, routeConditionsById, t)} />
        </div>
        <button
          type="button"
          className={`${styles.favToggle} ${isFav ? styles.favToggleOn : ''}`}
          aria-label={t(isFav ? 'favorites.remove_route' : 'favorites.add_route')}
          title={t(isFav ? 'favorites.remove_route' : 'favorites.add_route')}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(r); }}
        >
          {isFav ? '★' : '☆'}
        </button>
      </div>
    );
  });
}