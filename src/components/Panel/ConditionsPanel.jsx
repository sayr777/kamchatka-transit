import React, { useMemo, useState } from 'react';
import {
  filterRoutesByCondition,
  filterStopsByCondition,
  getConditionFilters,
} from '../../utils/transportConditions';
import { RouteList, StopList } from './PanelLists';
import styles from './Panel.module.css';

function ConditionRouteList({ routes, routeMeta, routeConditionsById, favoriteRouteIds, onSelect, onToggleFavorite, t }) {
  if (!routes.length) return null;
  return (
    <>
      <div className={styles.favoritesTitle}>
        {t('panel.conditions.routes')}
        {' '}
        (
        {routes.length}
        )
      </div>
      <RouteList
        routes={routes}
        routeMeta={routeMeta}
        routeConditionsById={routeConditionsById}
        favoriteRouteIds={favoriteRouteIds}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        t={t}
      />
    </>
  );
}

function ConditionStopList({ stops, favoriteStopIds, onSelect, onToggleFavorite, t }) {
  if (!stops.length) return null;
  return (
    <>
      <div className={styles.favoritesTitle}>
        {t('panel.conditions.stops')}
        {' '}
        (
        {stops.length}
        )
      </div>
      <StopList
        stops={stops}
        favoriteStopIds={favoriteStopIds}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        t={t}
      />
    </>
  );
}

export default function ConditionsPanel({
  allRoutes,
  allStops,
  routeMetaById,
  routeConditionsById,
  favoriteStopIds,
  favoriteRouteIds,
  onStopSelect,
  onRouteSelect,
  onStopFavoriteToggle,
  onRouteFavoriteToggle,
  t,
}) {
  const filters = useMemo(() => getConditionFilters(t), [t]);
  const [filter, setFilter] = useState(filters[0]?.key || 'wheelchair');

  const routes = useMemo(
    () => filterRoutesByCondition(allRoutes, routeConditionsById, filter),
    [allRoutes, routeConditionsById, filter],
  );
  const stops = useMemo(
    () => filterStopsByCondition(allStops, filter),
    [allStops, filter],
  );

  const empty = !routes.length && !stops.length;
  const activeFilter = filters.find((f) => f.key === filter);

  return (
    <>
      <div className={styles.condFilters} role="tablist" aria-label={t('panel.tab.conditions')}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`${styles.condChip} ${filter === f.key ? styles.condChipActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            <span className={styles.condChipIcon} aria-hidden="true">{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      {empty ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>{activeFilter?.icon || '♿'}</div>
          <div className={styles.emptyText}>{t('panel.empty.conditions')}</div>
        </div>
      ) : (
        <>
          <ConditionRouteList
            routes={routes}
            routeMeta={routeMetaById}
            routeConditionsById={routeConditionsById}
            favoriteRouteIds={favoriteRouteIds}
            onSelect={onRouteSelect}
            onToggleFavorite={onRouteFavoriteToggle}
            t={t}
          />
          <ConditionStopList
            stops={stops}
            favoriteStopIds={favoriteStopIds}
            onSelect={onStopSelect}
            onToggleFavorite={onStopFavoriteToggle}
            t={t}
          />
        </>
      )}
    </>
  );
}