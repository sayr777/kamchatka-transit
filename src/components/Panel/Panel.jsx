import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import { resolveFavoriteStops, resolveFavoriteRoutes } from '../../utils/favorites';
import { getRouteConditionTags, getStopConditionTags } from '../../utils/transportConditions';
import TransportTags from '../UI/TransportTags';
import MapView from '../Map/MapView';
import ConditionsPanel from './ConditionsPanel';
import { RouteList, StopList } from './PanelLists';
import styles from './Panel.module.css';

function FavoriteStopList({ stops, onSelect, onRemove, t }) {
  if (!stops.length) return null;
  return (
    <>
      <div className={styles.favoritesTitle}>{t('panel.favorites.stops')}</div>
      {stops.map((s) => (
        <div key={s.stop_id} className={styles.listItem}>
          <span className={styles.favDot}>★</span>
          <div className={styles.itemInfo} onClick={() => onSelect(s)}>
            <div className={styles.itemName}>{s.stop_name}</div>
            <div className={styles.itemSub}>{s.stop_code || s.stop_id}</div>
            <TransportTags tags={getStopConditionTags(s, t)} />
          </div>
          <button
            type="button"
            className={styles.favRemove}
            aria-label={t('favorites.remove_stop')}
            title={t('favorites.remove_stop')}
            onClick={(e) => { e.stopPropagation(); onRemove(s); }}
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}

function FavoriteRouteList({ routes, routeMeta, routeConditionsById, onSelect, onRemove, t }) {
  if (!routes.length) return null;
  return (
    <>
      <div className={styles.favoritesTitle}>{t('panel.favorites.routes')}</div>
      {routes.map((r) => {
        const meta = routeMeta.get(r.route_id);
        return (
          <div key={r.route_id} className={styles.listItem}>
            <div
              className={styles.pill}
              style={{ background: meta?.hex || '#1e78d0' }}
              onClick={() => onSelect(r)}
            >
              {r.route_short_name || r.route_id}
            </div>
            <div className={styles.itemInfo} onClick={() => onSelect(r)}>
              <div className={styles.itemName}>{r.route_long_name || r.route_short_name}</div>
              <TransportTags tags={getRouteConditionTags(r.route_id, routeConditionsById, t)} />
            </div>
            <button
              type="button"
              className={styles.favRemove}
              aria-label={t('favorites.remove_route')}
              title={t('favorites.remove_route')}
              onClick={(e) => { e.stopPropagation(); onRemove(r); }}
            >
              ×
            </button>
          </div>
        );
      })}
    </>
  );
}

function FavoritesPanel({
  favoriteStops,
  favoriteRoutes,
  routeMetaById,
  routeConditionsById,
  onStopSelect,
  onRouteSelect,
  onStopRemove,
  onRouteRemove,
  t,
}) {
  const empty = !favoriteStops.length && !favoriteRoutes.length;
  if (empty) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>★</div>
        <div className={styles.emptyText}>{t('panel.empty.favorites')}</div>
      </div>
    );
  }
  return (
    <>
      <FavoriteStopList stops={favoriteStops} onSelect={onStopSelect} onRemove={onStopRemove} t={t} />
      <FavoriteRouteList
        routes={favoriteRoutes}
        routeMeta={routeMetaById}
        routeConditionsById={routeConditionsById}
        onSelect={onRouteSelect}
        onRemove={onRouteRemove}
        t={t}
      />
    </>
  );
}

function useRouteSelect(onClose) {
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);

  return useCallback((r) => {
    setActiveRoute(r.route_id);
    const { firstShapeByRoute, shapesByShapeId } = useAppStore.getState();
    const shapeId = firstShapeByRoute?.get(r.route_id);
    const pts = shapeId ? shapesByShapeId?.get(shapeId) : null;
    if (pts?.length) {
      MapView.flyTo({
        longitude: parseFloat(pts[0].shape_pt_lon ?? pts[0].lon ?? pts[0][0]),
        latitude:  parseFloat(pts[0].shape_pt_lat ?? pts[0].lat ?? pts[0][1]),
        zoom: 13, transitionDuration: 600,
      });
    }
    onClose?.();
  }, [setActiveRoute, onClose]);
}

function usePanelFavorites(allStops, allRoutes) {
  const favoriteStopIds = useAppStore((s) => s.favoriteStopIds);
  const favoriteRouteIds = useAppStore((s) => s.favoriteRouteIds);
  const toggleFavoriteStop = useAppStore((s) => s.toggleFavoriteStop);
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute);
  const setChip = useAppStore((s) => s.setChip);
  const t = useT();

  const favoriteStops = useMemo(
    () => resolveFavoriteStops(favoriteStopIds, allStops),
    [favoriteStopIds, allStops],
  );
  const favoriteRoutes = useMemo(
    () => resolveFavoriteRoutes(favoriteRouteIds, allRoutes),
    [favoriteRouteIds, allRoutes],
  );

  const handleFavoriteStopRemove = useCallback((stop) => {
    toggleFavoriteStop(stop.stop_id);
    setChip(t('favorites.stop_removed'), 2000);
  }, [toggleFavoriteStop, setChip, t]);

  const handleFavoriteRouteRemove = useCallback((route) => {
    toggleFavoriteRoute(route.route_id);
    setChip(t('favorites.route_removed'), 2000);
  }, [toggleFavoriteRoute, setChip, t]);

  const handleRouteFavoriteToggle = useCallback((route) => {
    const added = toggleFavoriteRoute(route.route_id);
    setChip(t(added ? 'favorites.route_added' : 'favorites.route_removed'), 2000);
  }, [toggleFavoriteRoute, setChip, t]);

  const handleStopFavoriteToggle = useCallback((stop) => {
    const added = toggleFavoriteStop(stop.stop_id);
    setChip(t(added ? 'favorites.stop_added' : 'favorites.stop_removed'), 2000);
  }, [toggleFavoriteStop, setChip, t]);

  return {
    favoriteStopIds,
    favoriteRouteIds,
    favoriteStops,
    favoriteRoutes,
    handleFavoriteStopRemove,
    handleFavoriteRouteRemove,
    handleStopFavoriteToggle,
    handleRouteFavoriteToggle,
  };
}

export function BottomSheet({ open, onClose, initialTab = 'stops' }) {
  const t = useT();
  const [tab, setTab] = useState(initialTab);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setExpanded(true);
    }
  }, [open, initialTab]);

  const allStops = useAppStore((s) => s.allStops);
  const allRoutes = useAppStore((s) => s.allRoutes);
  const routeMetaById = useAppStore((s) => s.routeMetaById);
  const routeConditionsById = useAppStore((s) => s.routeConditionsById);
  const selectStop = useAppStore((s) => s.selectStop);
  const setPopup = useAppStore((s) => s.setPopup);

  const {
    favoriteStopIds,
    favoriteRouteIds,
    favoriteStops,
    favoriteRoutes,
    handleFavoriteStopRemove,
    handleFavoriteRouteRemove,
    handleStopFavoriteToggle,
    handleRouteFavoriteToggle,
  } = usePanelFavorites(allStops, allRoutes);

  const sheetRef = useRef(null);
  const dragStartY = useRef(null);
  const dragStartH = useRef(null);

  const handlePointerDown = useCallback((e) => {
    dragStartY.current = e.clientY;
    dragStartH.current = sheetRef.current?.offsetHeight || 72;
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (dragStartY.current === null) return;
    const dy = dragStartY.current - e.clientY;
    const newH = Math.min(window.innerHeight * 0.85, Math.max(72, dragStartH.current + dy));
    if (sheetRef.current) sheetRef.current.style.height = `${newH}px`;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragStartY.current === null) return;
    const h = sheetRef.current?.offsetHeight || 72;
    setExpanded(h > 140);
    if (sheetRef.current) sheetRef.current.style.height = '';
    dragStartY.current = null;
  }, []);

  const handleStopSelect = useCallback((stop) => {
    selectStop(stop);
    setPopup({ type: 'stop', stop, x: window.innerWidth / 2, y: window.innerHeight * 0.4 });
    MapView.flyTo({ longitude: parseFloat(stop.stop_lon), latitude: parseFloat(stop.stop_lat), zoom: 15, transitionDuration: 600 });
    onClose?.();
  }, [selectStop, setPopup, onClose]);

  const handleRouteSelect = useRouteSelect(onClose);

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${open ? styles.sheetOpen : ''} ${expanded ? styles.expanded : ''}`}
    >
      <div
        className={styles.handle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <button className={styles.closeBtn} aria-label="Закрыть" onClick={onClose}>×</button>
      </div>
      <div className={styles.body}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'stops' ? styles.active : ''}`} onClick={() => setTab('stops')}>
            {t('panel.tab.stops')}
          </button>
          <button className={`${styles.tab} ${tab === 'routes' ? styles.active : ''}`} onClick={() => setTab('routes')}>
            {t('panel.tab.routes')}
          </button>
          <button className={`${styles.tab} ${tab === 'conditions' ? styles.active : ''}`} onClick={() => setTab('conditions')}>
            {t('panel.tab.conditions')}
          </button>
          <button className={`${styles.tab} ${tab === 'favorites' ? styles.active : ''}`} onClick={() => setTab('favorites')}>
            {t('panel.tab.favorites')}
          </button>
        </div>
        {tab === 'stops' && (
          <StopList
            stops={allStops}
            favoriteStopIds={favoriteStopIds}
            onSelect={handleStopSelect}
            onToggleFavorite={handleStopFavoriteToggle}
            t={t}
          />
        )}
        {tab === 'routes' && (
          <RouteList
            routes={allRoutes}
            routeMeta={routeMetaById}
            routeConditionsById={routeConditionsById}
            favoriteRouteIds={favoriteRouteIds}
            onSelect={handleRouteSelect}
            onToggleFavorite={handleRouteFavoriteToggle}
            t={t}
          />
        )}
        {tab === 'conditions' && (
          <ConditionsPanel
            allRoutes={allRoutes}
            allStops={allStops}
            routeMetaById={routeMetaById}
            routeConditionsById={routeConditionsById}
            favoriteStopIds={favoriteStopIds}
            favoriteRouteIds={favoriteRouteIds}
            onStopSelect={handleStopSelect}
            onRouteSelect={handleRouteSelect}
            onStopFavoriteToggle={handleStopFavoriteToggle}
            onRouteFavoriteToggle={handleRouteFavoriteToggle}
            t={t}
          />
        )}
        {tab === 'favorites' && (
          <FavoritesPanel
            favoriteStops={favoriteStops}
            favoriteRoutes={favoriteRoutes}
            routeMetaById={routeMetaById}
            routeConditionsById={routeConditionsById}
            onStopSelect={handleStopSelect}
            onRouteSelect={handleRouteSelect}
            onStopRemove={handleFavoriteStopRemove}
            onRouteRemove={handleFavoriteRouteRemove}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

export function Sidebar({ open, onClose, initialTab = 'stops' }) {
  const t = useT();
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const allStops = useAppStore((s) => s.allStops);
  const allRoutes = useAppStore((s) => s.allRoutes);
  const routeMetaById = useAppStore((s) => s.routeMetaById);
  const routeConditionsById = useAppStore((s) => s.routeConditionsById);
  const selectStop = useAppStore((s) => s.selectStop);
  const setPopup = useAppStore((s) => s.setPopup);

  const {
    favoriteStopIds,
    favoriteRouteIds,
    favoriteStops,
    favoriteRoutes,
    handleFavoriteStopRemove,
    handleFavoriteRouteRemove,
    handleStopFavoriteToggle,
    handleRouteFavoriteToggle,
  } = usePanelFavorites(allStops, allRoutes);

  const handleStopSelect = useCallback((stop) => {
    selectStop(stop);
    setPopup({ type: 'stop', stop, x: window.innerWidth / 2, y: window.innerHeight * 0.4 });
    MapView.flyTo({ longitude: parseFloat(stop.stop_lon), latitude: parseFloat(stop.stop_lat), zoom: 15, transitionDuration: 600 });
  }, [selectStop, setPopup]);

  const handleRouteSelect = useRouteSelect(null);

  return (
    <div className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.sidebarBody}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'stops' ? styles.active : ''}`} onClick={() => setTab('stops')}>
            {t('panel.tab.stops')}
          </button>
          <button className={`${styles.tab} ${tab === 'routes' ? styles.active : ''}`} onClick={() => setTab('routes')}>
            {t('panel.tab.routes')}
          </button>
          <button className={`${styles.tab} ${tab === 'conditions' ? styles.active : ''}`} onClick={() => setTab('conditions')}>
            {t('panel.tab.conditions')}
          </button>
          <button className={`${styles.tab} ${tab === 'favorites' ? styles.active : ''}`} onClick={() => setTab('favorites')}>
            {t('panel.tab.favorites')}
          </button>
        </div>
        {tab === 'stops' && (
          <StopList
            stops={allStops}
            favoriteStopIds={favoriteStopIds}
            onSelect={handleStopSelect}
            onToggleFavorite={handleStopFavoriteToggle}
            t={t}
          />
        )}
        {tab === 'routes' && (
          <RouteList
            routes={allRoutes}
            routeMeta={routeMetaById}
            routeConditionsById={routeConditionsById}
            favoriteRouteIds={favoriteRouteIds}
            onSelect={handleRouteSelect}
            onToggleFavorite={handleRouteFavoriteToggle}
            t={t}
          />
        )}
        {tab === 'conditions' && (
          <ConditionsPanel
            allRoutes={allRoutes}
            allStops={allStops}
            routeMetaById={routeMetaById}
            routeConditionsById={routeConditionsById}
            favoriteStopIds={favoriteStopIds}
            favoriteRouteIds={favoriteRouteIds}
            onStopSelect={handleStopSelect}
            onRouteSelect={handleRouteSelect}
            onStopFavoriteToggle={handleStopFavoriteToggle}
            onRouteFavoriteToggle={handleRouteFavoriteToggle}
            t={t}
          />
        )}
        {tab === 'favorites' && (
          <FavoritesPanel
            favoriteStops={favoriteStops}
            favoriteRoutes={favoriteRoutes}
            routeMetaById={routeMetaById}
            routeConditionsById={routeConditionsById}
            onStopSelect={handleStopSelect}
            onRouteSelect={handleRouteSelect}
            onStopRemove={handleFavoriteStopRemove}
            onRouteRemove={handleFavoriteRouteRemove}
            t={t}
          />
        )}
      </div>
    </div>
  );
}