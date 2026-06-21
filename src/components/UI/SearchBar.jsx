import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import MapView from '../Map/MapView';
import { looksLikeRouteQuery, normalizeSearchQuery, searchRoutes, searchStops } from '../../utils/gtfsSearch';
import styles from './SearchBar.module.css';
import Tooltip from './Tooltip';

export default function SearchBar() {
  const t = useT();
  const open = useAppStore((s) => s.searchOpen);
  const query = useAppStore((s) => s.searchQuery);
  const allStops = useAppStore((s) => s.allStops);
  const allRoutes = useAppStore((s) => s.allRoutes);
  const routeMetaById = useAppStore((s) => s.routeMetaById);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const selectStop = useAppStore((s) => s.selectStop);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const setPopup = useAppStore((s) => s.setPopup);
  const favoriteStopIds = useAppStore((s) => s.favoriteStopIds);
  const favoriteRouteIds = useAppStore((s) => s.favoriteRouteIds);
  const toggleFavoriteStop = useAppStore((s) => s.toggleFavoriteStop);
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute);
  const setChip = useAppStore((s) => s.setChip);

  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = normalizeSearchQuery(query);
  const routeHits = searchRoutes(allRoutes, q, routeMetaById, 6).map((r) => ({
    type: 'route',
    label: r.route_short_name || r.route_long_name || r.route_id,
    sub: r.route_long_name || '',
    data: r,
  }));
  const stopHits = searchStops(allStops, q, 6).map((s) => ({
    type: 'stop',
    label: s.stop_name,
    sub: s.stop_code || s.stop_id,
    data: s,
  }));
  const routeFirst = looksLikeRouteQuery(q);
  const results = q.length >= 1
    ? (routeFirst ? [...routeHits, ...stopHits] : [...stopHits, ...routeHits]).slice(0, 10)
    : [];

  const handleStopFavorite = (e, stop) => {
    e.stopPropagation();
    const added = toggleFavoriteStop(stop.stop_id);
    setChip(t(added ? 'favorites.stop_added' : 'favorites.stop_removed'), 2000);
  };

  const handleRouteFavorite = (e, route) => {
    e.stopPropagation();
    const added = toggleFavoriteRoute(route.route_id);
    setChip(t(added ? 'favorites.route_added' : 'favorites.route_removed'), 2000);
  };

  const handleSelect = (item) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (item.type === 'stop') {
      const s = item.data;
      const lon = parseFloat(s.stop_lon);
      const lat = parseFloat(s.stop_lat);
      selectStop(s);
      setPopup({ type: 'stop', stop: s, x: window.innerWidth / 2, y: window.innerHeight * 0.4 });
      MapView.flyTo({ longitude: lon, latitude: lat, zoom: 15, transitionDuration: 600 });
    } else if (item.type === 'route') {
      const r = item.data;
      setPopup(null);
      setActiveRoute(r.route_id);
      const { firstShapeByRoute, shapesByShapeId } = useAppStore.getState();
      const shapeId = firstShapeByRoute?.get(r.route_id);
      const pts = shapeId ? shapesByShapeId?.get(shapeId) : null;
      if (pts?.length) {
        MapView.flyTo({
          longitude: parseFloat(pts[0].shape_pt_lon ?? pts[0].lon ?? pts[0][0]),
          latitude: parseFloat(pts[0].shape_pt_lat ?? pts[0].lat ?? pts[0][1]),
          zoom: 13,
          transitionDuration: 600,
        });
      }
    }
  };

  const bar = (
    <div
      id="search-bar"
      className={`${styles.bar} ${open ? styles.open : ''}`}
      onClick={() => !open && setSearchOpen(true)}
    >
      {!open && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>}
      {open && (
        <>
          <div className={styles.inputRow}>
            <input
              ref={inputRef}
              className={styles.input}
              placeholder={t('search.placeholder')}
              value={query}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && (setSearchOpen(false), setSearchQuery(''))}
            />
            <button className={styles.close} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
          </div>
          {results.length > 0 && (
            <div className={styles.results}>
              {results.map((item, i) => {
                const isFav = item.type === 'stop'
                  ? favoriteStopIds.includes(item.data.stop_id)
                  : favoriteRouteIds.includes(item.data.route_id);
                return (
                  <div
                    key={i}
                    className={styles.item}
                    onClick={(e) => { e.stopPropagation(); handleSelect(item); }}
                  >
                    <span className={styles.itemIcon}>{item.type === 'stop' ? '🚏' : '🚌'}</span>
                    <div className={styles.itemText}>
                      <div className={styles.itemLabel}>{item.label}</div>
                      {item.sub && <div className={styles.itemSub}>{item.sub}</div>}
                    </div>
                    <Tooltip
                      label={t(
                        item.type === 'stop'
                          ? (isFav ? 'favorites.remove_stop' : 'favorites.add_stop')
                          : (isFav ? 'favorites.remove_route' : 'favorites.add_route'),
                      )}
                      side="top"
                    >
                      <button
                        type="button"
                        className={`${styles.favBtn} ${isFav ? styles.favBtnOn : ''}`}
                        aria-label={t(
                          item.type === 'stop'
                            ? (isFav ? 'favorites.remove_stop' : 'favorites.add_stop')
                            : (isFav ? 'favorites.remove_route' : 'favorites.add_route'),
                        )}
                        onClick={(e) => (
                          item.type === 'stop'
                            ? handleStopFavorite(e, item.data)
                            : handleRouteFavorite(e, item.data)
                        )}
                      >
                        {isFav ? '★' : '☆'}
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (open) return bar;

  return <Tooltip label={t('search.title')}>{bar}</Tooltip>;
}
