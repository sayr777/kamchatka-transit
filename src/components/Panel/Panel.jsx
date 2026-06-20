import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import MapView from '../Map/MapView';
import styles from './Panel.module.css';

function StopList({ stops, onSelect }) {
  if (!stops.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🚏</div>
        <div className={styles.emptyText}>Нет данных об остановках</div>
      </div>
    );
  }
  return stops.map((s) => (
    <div key={s.stop_id} className={styles.listItem} onClick={() => onSelect(s)}>
      <span className={styles.dot}>⬤</span>
      <div className={styles.itemInfo}>
        <div className={styles.itemName}>{s.stop_name}</div>
        <div className={styles.itemSub}>{s.stop_code || s.stop_id}</div>
      </div>
    </div>
  ));
}

function RouteList({ routes, routeMeta, onSelect }) {
  if (!routes.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🚌</div>
        <div className={styles.emptyText}>Нет данных о маршрутах</div>
      </div>
    );
  }
  return routes.map((r) => {
    const meta = routeMeta.get(r.route_id);
    return (
      <div key={r.route_id} className={styles.listItem} onClick={() => onSelect(r)}>
        <div className={styles.pill} style={{ background: meta?.hex || '#1e78d0' }}>
          {r.route_short_name || r.route_id}
        </div>
        <div className={styles.itemInfo}>
          <div className={styles.itemName}>{r.route_long_name || r.route_short_name}</div>
          <div className={styles.itemSub}>{r.agency_id || ''}</div>
        </div>
      </div>
    );
  });
}

// ── Mobile BottomSheet ───────────────────────────────────────────
export function BottomSheet({ open, onClose }) {
  const [tab, setTab] = useState('stops');
  const [expanded, setExpanded] = useState(false);
  const allStops = useAppStore((s) => s.allStops);
  const allRoutes = useAppStore((s) => s.allRoutes);
  const routeMetaById = useAppStore((s) => s.routeMetaById);
  const setPopup = useAppStore((s) => s.setPopup);
  const setActiveStop = useAppStore((s) => s.setActiveStop);

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
    const isExpand = h > 140;
    setExpanded(isExpand);
    if (sheetRef.current) sheetRef.current.style.height = '';
    dragStartY.current = null;
  }, []);

  const handleStopSelect = (stop) => {
    setActiveStop(stop.stop_id);
    MapView.flyTo({ longitude: parseFloat(stop.stop_lon), latitude: parseFloat(stop.stop_lat), zoom: 15 });
  };

  if (!open) return null;

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${expanded ? styles.expanded : ''}`}
    >
      <div
        className={styles.handle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>
      <div className={styles.body}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'stops' ? styles.active : ''}`} onClick={() => setTab('stops')}>
            Остановки
          </button>
          <button className={`${styles.tab} ${tab === 'routes' ? styles.active : ''}`} onClick={() => setTab('routes')}>
            Маршруты
          </button>
        </div>
        {tab === 'stops' && <StopList stops={allStops} onSelect={handleStopSelect} />}
        {tab === 'routes' && <RouteList routes={allRoutes} routeMeta={routeMetaById} onSelect={() => {}} />}
      </div>
    </div>
  );
}

// ── Desktop Sidebar ──────────────────────────────────────────────
export function Sidebar({ open, onClose }) {
  const [tab, setTab] = useState('stops');
  const allStops = useAppStore((s) => s.allStops);
  const allRoutes = useAppStore((s) => s.allRoutes);
  const routeMetaById = useAppStore((s) => s.routeMetaById);
  const setActiveStop = useAppStore((s) => s.setActiveStop);

  const handleStopSelect = (stop) => {
    setActiveStop(stop.stop_id);
    MapView.flyTo({ longitude: parseFloat(stop.stop_lon), latitude: parseFloat(stop.stop_lat), zoom: 15 });
  };

  return (
    <div className={`${styles.sidebar} ${open ? styles.open : ''}`}>
      <div className={styles.sidebarBody}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'stops' ? styles.active : ''}`} onClick={() => setTab('stops')}>
            Остановки
          </button>
          <button className={`${styles.tab} ${tab === 'routes' ? styles.active : ''}`} onClick={() => setTab('routes')}>
            Маршруты
          </button>
        </div>
        {tab === 'stops' && <StopList stops={allStops} onSelect={handleStopSelect} />}
        {tab === 'routes' && <RouteList routes={allRoutes} routeMeta={routeMetaById} onSelect={() => {}} />}
      </div>
    </div>
  );
}
