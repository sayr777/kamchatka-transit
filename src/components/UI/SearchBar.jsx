import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import MapView from '../Map/MapView';
import styles from './SearchBar.module.css';

export default function SearchBar() {
  const open = useAppStore((s) => s.searchOpen);
  const query = useAppStore((s) => s.searchQuery);
  const allStops = useAppStore((s) => s.allStops);
  const allRoutes = useAppStore((s) => s.allRoutes);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setActiveStop = useAppStore((s) => s.setActiveStop);
  const setPopup = useAppStore((s) => s.setPopup);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.toLowerCase();
  const results = query.length > 1 ? [
    ...allStops
      .filter(s => s.stop_name?.toLowerCase().includes(q))
      .slice(0, 6)
      .map(s => ({ type: 'stop', label: s.stop_name, sub: s.stop_code || s.stop_id, data: s })),
    ...allRoutes
      .filter(r => (r.route_short_name || r.route_long_name)?.toLowerCase().includes(q))
      .slice(0, 4)
      .map(r => ({ type: 'route', label: r.route_short_name || r.route_long_name, sub: r.route_long_name || '', data: r })),
  ] : [];

  const handleSelect = (item) => {
    setSearchOpen(false);
    setSearchQuery('');
    if (item.type === 'stop') {
      const s = item.data;
      const lon = parseFloat(s.stop_lon);
      const lat = parseFloat(s.stop_lat);
      MapView.flyTo({ longitude: lon, latitude: lat, zoom: 16, transitionDuration: 600 });
      setActiveStop(s.stop_id);
      setTimeout(() => {
        setPopup({ type: 'stop', stop: s, x: window.innerWidth / 2, y: window.innerHeight * 0.4 });
      }, 650);
    } else if (item.type === 'route') {
      // TODO: показать маршрут
      console.log('[Search] route selected:', item.data.route_id);
    }
  };

  return (
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
              placeholder="Маршрут или остановка…"
              value={query}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && (setSearchOpen(false), setSearchQuery(''))}
            />
            <button className={styles.close} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
          </div>
          {results.length > 0 && (
            <div className={styles.results}>
              {results.map((item, i) => (
                <div key={i} className={styles.item} onClick={() => handleSelect(item)}>
                  <span className={styles.itemIcon}>{item.type === 'stop' ? '🚏' : '🚌'}</span>
                  <div className={styles.itemText}>
                    <div className={styles.itemLabel}>{item.label}</div>
                    {item.sub && <div className={styles.itemSub}>{item.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
