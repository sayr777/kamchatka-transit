import React, { useEffect, useCallback, useState, lazy, Suspense } from 'react';
const MapView = lazy(() => import('./components/Map/MapView'));
import SearchBar from './components/UI/SearchBar';
import TiltButton from './components/UI/TiltButton';
import LocateButton from './components/UI/LocateButton';
import PlannerButton from './components/UI/PlannerButton';
import FeedButton from './components/UI/FeedButton';
import FavoritesButton from './components/UI/FavoritesButton';
import ConditionsButton from './components/UI/ConditionsButton';
import Chip from './components/UI/Chip';
import Splash from './components/Splash';
import StopPopup from './components/StopPopup/StopPopup';
import { BottomSheet, Sidebar } from './components/Panel/Panel';
import { useAppStore } from './store/appStore';
import { useT } from './i18n';
import { loadGtfsFeed, refreshFeedsInBackground } from './gtfs/loader';
import { startVehicleTracker } from './realtime/vehicleTracker';
import { startWeatherSync } from './weather/weatherSync';
import TopBar from './components/UI/TopBar';
import PlannerPanel from './components/Planner/PlannerPanel';
import styles from './App.module.css';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export default function App() {
  const splash = useAppStore((s) => s.splash);
  const lang = useAppStore((s) => s.lang);
  const setGtfsData = useAppStore((s) => s.setGtfsData);
  const setChip = useAppStore((s) => s.setChip);
  const t = useT();
  const isMobile = useIsMobile();

  // Загрузка GTFS
  useEffect(() => {
    if (splash) return;
    console.log(`[App] loading GTFS for lang=${lang}`);
    loadGtfsFeed(lang, (step) => console.log(`[App] GTFS progress: ${step}`))
      .then((data) => {
        console.log(`[App] GTFS ready — ${data.allStops?.length ?? data.stops?.length} stops, ${data.allRoutes?.length ?? data.routes?.length} routes`);
        setGtfsData({
          allRoutes: data.routes,
          allStops: data.stops,
          routeMetaById: data.routeMetaById,
          arrivalsByStopId: data.arrivalsByStopId,
          tripToService: data.tripToService,
          tripToRoute: data.tripToRoute,
          tripMetaById: data.tripMetaById,
          frequenciesByTripId: data.frequenciesByTripId,
          tripFirstDepMinByTripId: data.tripFirstDepMinByTripId,
          calendarByServiceId: data.calendarByServiceId,
          shapesByShapeId: data.shapesByShapeId,
          firstShapeByRoute: data.firstShapeByRoute,
          stopIdsByRouteId: data.stopIdsByRouteId,
          routeIdsByStopId: data.routeIdsByStopId,
          routeConditionsById: data.routeConditionsById,
          vehicleTypeById: data.vehicleTypeById,
          plannerAdjacency: data.plannerAdjacency,
        });
        setTimeout(() => refreshFeedsInBackground(), 3000);
        setTimeout(() => startVehicleTracker(null /* TODO: wsUrl */), 1000);
      })
      .catch((e) => { console.error('[App] GTFS error:', e); setChip(t('error.gtfs')); });
  }, [lang, splash]);

  // Погода Yandex — после загрузки карты
  useEffect(() => {
    if (splash) return;
    const stop = startWeatherSync();
    return stop;
  }, [splash]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState('stops');
  const openPanel = useCallback((tab = 'stops') => {
    setPanelTab(tab);
    setPanelOpen(true);
  }, []);

  const handleMapClick = useCallback((info) => {
    if (!info.object) return;
  }, []);

  if (splash) return <Splash />;

  return (
    <div className={styles.app}>
      <Suspense fallback={null}>
        <MapView onMapClick={handleMapClick} />
      </Suspense>

      {/* Панель остановок/маршрутов */}
      {isMobile
        ? <BottomSheet open={panelOpen} onClose={() => setPanelOpen(false)} initialTab={panelTab} />
        : <Sidebar open={panelOpen} onClose={() => setPanelOpen(false)} initialTab={panelTab} />
      }

      <TopBar />
      <PlannerPanel />

      {/* FAB кнопки — единая колонка справа */}
      <div className={styles.fabColumn}>
        <TiltButton />
        <SearchBar />
        <PlannerButton />
        <FavoritesButton onOpen={() => openPanel('favorites')} />
        <ConditionsButton onOpen={() => openPanel('conditions')} />
        <div className={styles.fabSpacer} aria-hidden="true" />
        <FeedButton />
        <LocateButton />
      </div>

      {/* Попапы */}
      <StopPopup />

      {/* Уведомления */}
      <Chip />
    </div>
  );
}
