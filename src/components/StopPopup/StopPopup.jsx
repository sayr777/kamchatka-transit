import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useT } from '../../i18n';
import MapView from '../Map/MapView';
import TransportTags from '../UI/TransportTags';
import { getStopConditionTags } from '../../utils/transportConditions';
import { getRouteIdsForStop } from '../../utils/stopFocus';
import {
  buildStopDepartureBoard,
  formatClock,
  formatDepartureCountdown,
  formatDelayStatusLabel,
  refreshStopBoardLive,
  toGtfsDate,
} from '../../utils/stopDepartures';
import styles from './StopPopup.module.css';

export default function StopPopup() {
  const t = useT();
  const lang = useAppStore((s) => s.lang);
  const popup = useAppStore((s) => s.popup);
  const closePopup = useAppStore((s) => s.closePopup);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const clearRoute = useAppStore((s) => s.clearRoute);
  const activeRouteId = useAppStore((s) => s.route?.id);
  const arrivalsByStopId = useAppStore((s) => s.arrivalsByStopId);
  const tripToService = useAppStore((s) => s.tripToService);
  const tripToRoute = useAppStore((s) => s.tripToRoute);
  const tripMetaById = useAppStore((s) => s.tripMetaById);
  const frequenciesByTripId = useAppStore((s) => s.frequenciesByTripId);
  const tripFirstDepMinByTripId = useAppStore((s) => s.tripFirstDepMinByTripId);
  const calendarByServiceId = useAppStore((s) => s.calendarByServiceId);
  const routeMetaById = useAppStore((s) => s.routeMetaById);
  const routeIdsByStopId = useAppStore((s) => s.routeIdsByStopId);
  const vehicles = useAppStore((s) => s.vehicles);
  const vehicleTick = useAppStore((s) => s.vehicleTick);
  const favoriteStopIds = useAppStore((s) => s.favoriteStopIds);
  const toggleFavoriteStop = useAppStore((s) => s.toggleFavoriteStop);
  const setChip = useAppStore((s) => s.setChip);

  const [nowTick, setNowTick] = useState(0);
  const [displayBoard, setDisplayBoard] = useState({ groups: [], isEmpty: true, noService: false });
  const frozenBoardRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNowTick((v) => v + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const stop = popup?.type === 'stop' ? popup.stop : null;
  const stopId = stop?.stop_id;

  const nowMin = useMemo(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, [nowTick]);

  const arrivals = useMemo(
    () => (stop ? arrivalsByStopId.get(stop.stop_id) || [] : []),
    [stop, arrivalsByStopId],
  );

  const stopRouteIds = useMemo(() => {
    if (!stop) return [];
    return getRouteIdsForStop(stop.stop_id, routeIdsByStopId, arrivalsByStopId);
  }, [stop, routeIdsByStopId, arrivalsByStopId]);

  const boardRouteIds = useMemo(() => {
    if (activeRouteId && stopRouteIds.includes(activeRouteId)) return [activeRouteId];
    return stopRouteIds;
  }, [stopRouteIds, activeRouteId]);

  const boardArrivals = useMemo(() => {
    if (!activeRouteId) return arrivals;
    return arrivals.filter((a) => {
      const rid = a.routeId || tripToRoute?.get(a.tripId);
      return rid === activeRouteId;
    });
  }, [arrivals, activeRouteId, tripToRoute]);

  const buildBoard = (minute) => {
    if (!stop) return { groups: [], isEmpty: true, noService: false };
    return buildStopDepartureBoard({
      stop,
      arrivals: boardArrivals,
      frequenciesByTripId,
      tripFirstDepMinByTripId,
      tripMetaById,
      tripToService,
      tripToRoute,
      calendarByServiceId,
      routeMetaById,
      vehicles,
      stopRouteIds: boardRouteIds,
      gtfsDate: toGtfsDate(),
      nowMin: minute,
    });
  };

  useEffect(() => {
    if (!stopId) {
      frozenBoardRef.current = null;
      setDisplayBoard({ groups: [], isEmpty: true, noService: false });
      return;
    }
    const board = buildBoard(nowMin);
    frozenBoardRef.current = board;
    setDisplayBoard(board);
  }, [
    stopId,
    activeRouteId,
    boardArrivals,
    boardRouteIds,
    frequenciesByTripId,
    tripFirstDepMinByTripId,
    tripMetaById,
    tripToService,
    tripToRoute,
    calendarByServiceId,
    routeMetaById,
  ]);

  useEffect(() => {
    if (!stopId || !frozenBoardRef.current) return;
    const fresh = buildBoard(nowMin);
    setDisplayBoard(refreshStopBoardLive(frozenBoardRef.current, fresh, nowMin));
  }, [nowTick, vehicleTick, vehicles, nowMin, stopId, activeRouteId]);

  const board = displayBoard;

  const stopRoutes = useMemo(() => stopRouteIds
    .map((routeId) => ({ routeId, meta: routeMetaById.get(routeId) }))
    .sort((a, b) => String(a.meta?.shortName || a.routeId)
      .localeCompare(String(b.meta?.shortName || b.routeId), undefined, { numeric: true })),
  [stopRouteIds, routeMetaById]);

  if (!popup || popup.type !== 'stop') return null;

  const isFavorite = favoriteStopIds.includes(stop.stop_id);

  const handleFavoriteToggle = () => {
    const added = toggleFavoriteStop(stop.stop_id);
    setChip(t(added ? 'favorites.stop_added' : 'favorites.stop_removed'), 2000);
  };

  const handleRouteBadge = (routeId) => {
    if (activeRouteId === routeId) {
      clearRoute();
      return;
    }
    setActiveRoute(routeId);
    const { firstShapeByRoute, shapesByShapeId } = useAppStore.getState();
    const shapeId = firstShapeByRoute?.get(routeId);
    const pts = shapeId ? shapesByShapeId?.get(shapeId) : null;
    if (pts?.length) {
      MapView.flyTo({
        longitude: parseFloat(pts[0].shape_pt_lon ?? pts[0].lon ?? pts[0][0]),
        latitude: parseFloat(pts[0].shape_pt_lat ?? pts[0].lat ?? pts[0][1]),
        zoom: 13,
        transitionDuration: 600,
      });
    }
  };

  const PW = 292;
  const PH = 360;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const px = popup.x;
  const py = popup.y;
  let left = (px ?? W / 2) + 18;
  let top = (py ?? H / 2) - PH / 2;
  if (left + PW > W - 20) left = (px ?? W / 2) - PW - 14;
  if (top < 16) top = 16;
  if (top + PH > H - 20) top = H - PH - 20;

  return (
    <div className={styles.popup} style={{ left, top }}>
      <div className={styles.head}>
        <div className={styles.stopName}>{stop.stop_name || stop.name}</div>
        <div className={styles.headActions}>
          <button
            type="button"
            className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ''}`}
            aria-label={t(isFavorite ? 'favorites.remove_stop' : 'favorites.add_stop')}
            onClick={handleFavoriteToggle}
          >
            {isFavorite ? '★' : '☆'}
          </button>
          <button type="button" className={styles.close} onClick={closePopup}>×</button>
        </div>
      </div>

      <div className={styles.body}>
        <TransportTags tags={getStopConditionTags(stop, t)} />

        {stopRoutes.length > 0 && (
          <div className={styles.routes}>
            {stopRoutes.map(({ routeId, meta }) => (
              <button
                key={routeId}
                type="button"
                className={`${styles.badge} ${activeRouteId === routeId ? styles.badgeActive : ''}`}
                style={{ background: meta?.hex || '#2563eb' }}
                onClick={() => handleRouteBadge(routeId)}
              >
                {meta?.shortName || routeId}
              </button>
            ))}
          </div>
        )}

        <div className={styles.boardLabel}>{t('stop.arrivals')}</div>

        <div className={styles.board}>
          {board.noService && (
            <div className={styles.empty}>{t('stop.no_service')}</div>
          )}
          {!board.noService && board.isEmpty && (
            <div className={styles.empty}>{t('stop.no_data')}</div>
          )}
          {board.groups.map((group) => (
            <section key={`${group.routeId}-${group.headsign}`} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.routeBadge} style={{ background: group.routeColor }}>
                  {group.routeShort}
                </span>
                <div className={styles.groupCopy}>
                  {group.headsign && (
                    <div className={styles.headsign}>{group.headsign}</div>
                  )}
                  {group.interval && (
                    <div className={styles.interval}>
                      {t('stop.every_min', { n: group.interval.headwayMin })}
                      {' · '}
                      {t('stop.until', { time: formatClock(group.interval.untilMin) })}
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.rows}>
                {group.departures.map((dep, i) => (
                  <div
                    key={`${dep.tripId || 'slot'}-${dep.scheduledMins ?? dep.mins}-${i}`}
                    className={`${styles.row} ${dep.isNext ? styles.rowNext : ''}`}
                  >
                    <div className={styles.rowLeft}>
                      <span className={styles.countdown}>
                        {formatDepartureCountdown(dep.minutesAway, lang)}
                      </span>
                      {dep.isRealtime && (
                        <span className={styles.live}>{t('stop.live')}</span>
                      )}
                      {dep.delayStatus && (
                        <span className={`${styles.delay} ${styles[`delay_${dep.delayStatus}`]}`}>
                          {formatDelayStatusLabel(dep.delayStatus, dep.delayMinutes, lang)}
                        </span>
                      )}
                    </div>
                    <div className={styles.clockCol}>
                      <span className={styles.clock}>
                        {dep.isFrequency && !dep.isRealtime ? '~' : ''}{dep.clock}
                      </span>
                      {dep.scheduledClock && dep.delayStatus && (
                        <span className={styles.scheduledClock}>{dep.scheduledClock}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className={styles.code}>
          {stop.stop_code ? `${t('stop.code')}: ${stop.stop_code}` : `${t('stop.id')}: ${stop.stop_id}`}
        </div>
      </div>
    </div>
  );
}