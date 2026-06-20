import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import MapView from '../Map/MapView';
import styles from './StopPopup.module.css';

function toGtfsDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function formatTime(t) {
  const p = t.split(':');
  const h = parseInt(p[0]) % 24;
  return `${String(h).padStart(2, '0')}:${p[1]}`;
}

function parseTimeMin(t) {
  const p = t.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1]);
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getActiveServiceIds(gtfsDate, calendarByServiceId) {
  const y = parseInt(gtfsDate.slice(0, 4));
  const m = parseInt(gtfsDate.slice(4, 6)) - 1;
  const d = parseInt(gtfsDate.slice(6, 8));
  const day = DAYS[new Date(y, m, d).getDay()];
  const set = new Set();
  for (const [sid, row] of calendarByServiceId) {
    if (row[day] === '1' && gtfsDate >= row.start_date && gtfsDate <= row.end_date) {
      set.add(sid);
    }
  }
  return set;
}

export default function StopPopup() {
  const popup = useAppStore((s) => s.popup);
  const closePopup = useAppStore((s) => s.closePopup);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const clearRoute = useAppStore((s) => s.clearRoute);
  const activeRouteId = useAppStore((s) => s.route?.id);
  const arrivalsByStopId = useAppStore((s) => s.arrivalsByStopId);
  const tripToService = useAppStore((s) => s.tripToService);
  const tripToRoute = useAppStore((s) => s.tripToRoute);
  const calendarByServiceId = useAppStore((s) => s.calendarByServiceId);
  const routeMetaById = useAppStore((s) => s.routeMetaById);

  const today = useMemo(() => toGtfsDate(new Date()), []);
  const nowMin = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, []);

  const [dateStr, setDateStr] = useState(today);
  const [timeMin, setTimeMin] = useState(nowMin);

  if (!popup || popup.type !== 'stop') return null;

  const stop = popup.stop;
  const px = popup.x;
  const py = popup.y;

  const arrivals = arrivalsByStopId.get(stop.stop_id) || [];

  // Уникальные маршруты остановки
  const stopRoutes = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const a of arrivals) {
      const rid = a.routeId || tripToRoute?.get(a.tripId);
      if (rid && !seen.has(rid)) {
        seen.add(rid);
        result.push({ routeId: rid, meta: routeMetaById.get(rid) });
      }
    }
    return result;
  }, [arrivals, routeMetaById, tripToRoute]);

  const handleRouteBadge = (routeId) => {
    if (activeRouteId === routeId) {
      clearRoute();
    } else {
      setActiveRoute(routeId);
      const meta = routeMetaById.get(routeId);
      const { firstShapeByRoute } = useAppStore.getState();
      const shapeId = firstShapeByRoute?.get(routeId);
      // Fly to route start if shape available
      if (shapeId) {
        const { shapesByShapeId } = useAppStore.getState();
        const pts = shapesByShapeId?.get(shapeId);
        if (pts?.length) {
          MapView.flyTo({ longitude: parseFloat(pts[0].lon ?? pts[0][0]), latitude: parseFloat(pts[0].lat ?? pts[0][1]), zoom: 13, transitionDuration: 600 });
        }
      }
    }
  };

  const activeServices = getActiveServiceIds(dateStr.replace(/-/g, ''), calendarByServiceId);

  const filtered = arrivals.filter((a) => {
    const sid = tripToService.get(a.tripId);
    return !sid || activeServices.has(sid);
  });

  const startIdx = Math.max(0, filtered.findIndex((a) => a.mins >= timeMin));
  const shown = [];
  for (let i = 0; i < filtered.length && shown.length < 8; i++) {
    shown.push(filtered[(startIdx + i) % filtered.length]);
  }
  let firstNext = false;

  // Position the popup
  const PW = 244, PH = 260;
  const W = window.innerWidth, H = window.innerHeight;
  let left = (px ?? W / 2) + 18;
  let top = (py ?? H / 2) - PH / 2;
  if (left + PW > W - 20) left = (px ?? W / 2) - PW - 14;
  if (top < 16) top = 16;
  if (top + PH > H - 20) top = H - PH - 20;

  return (
    <div className={styles.popup} style={{ left, top }}>
      <div className={styles.head}>
        <div className={styles.stopName}>{stop.stop_name || stop.name}</div>
        <button className={styles.close} onClick={closePopup}>×</button>
      </div>
      <div className={styles.body}>
        <div className={styles.routes}>
          {stopRoutes.map(({ routeId, meta }) => (
            <button
              key={routeId}
              className={`${styles.badge} ${activeRouteId === routeId ? styles.badgeActive : ''}`}
              style={{ background: meta?.hex || '#2563eb' }}
              onClick={() => handleRouteBadge(routeId)}
              title="Показать маршрут на карте"
            >
              🚌 {meta?.shortName || routeId}
            </button>
          ))}
        </div>
        <div className={styles.dateRow}>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
          <input
            type="time"
            value={`${String(Math.floor(timeMin / 60)).padStart(2, '0')}:${String(timeMin % 60).padStart(2, '0')}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':');
              setTimeMin(parseInt(h) * 60 + parseInt(m));
            }}
          />
        </div>
        <div className={styles.label}>Ближайшие рейсы</div>
        <div className={styles.times}>
          {shown.length === 0 && (
            <span className={styles.noTimes}>
              {filtered.length === 0 ? 'Нет рейсов в этот день' : 'Нет данных'}
            </span>
          )}
          {shown.map((a, i) => {
            const isNext = !firstNext && a.mins >= timeMin;
            if (isNext) firstNext = true;
            return (
              <div key={i} className={`${styles.time} ${isNext ? styles.next : ''}`}>
                {formatTime(a.time)}
              </div>
            );
          })}
        </div>
        <div className={styles.code}>
          {stop.stop_code ? `Код: ${stop.stop_code}` : `ID: ${stop.stop_id}`}
        </div>
      </div>
    </div>
  );
}
