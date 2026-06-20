import React, { useEffect, useCallback, useState, lazy, Suspense } from 'react';
const MapView = lazy(() => import('./components/Map/MapView'));
import SearchBar from './components/UI/SearchBar';
import TiltButton from './components/UI/TiltButton';
import LocateButton from './components/UI/LocateButton';
import PlannerButton from './components/UI/PlannerButton';
import FeedButton from './components/UI/FeedButton';
import Chip from './components/UI/Chip';
import Splash from './components/Splash';
import StopPopup from './components/StopPopup/StopPopup';
import { BottomSheet, Sidebar } from './components/Panel/Panel';
import { useAppStore } from './store/appStore';
import { loadGtfsFeed, refreshFeedsInBackground } from './gtfs/loader';
import { startVehicleTracker } from './realtime/vehicleTracker';
import styles from './App.module.css';

export default function App() {
  const splash = useAppStore((s) => s.splash);
  const lang = useAppStore((s) => s.lang);
  const setGtfsData = useAppStore((s) => s.setGtfsData);
  const setChip = useAppStore((s) => s.setChip);

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
          calendarByServiceId: data.calendarByServiceId,
          shapesByShapeId: data.shapesByShapeId,
          firstShapeByRoute: data.firstShapeByRoute,
        });
        setTimeout(() => refreshFeedsInBackground(), 3000);
        setTimeout(() => startVehicleTracker(null /* TODO: wsUrl */), 1000);
      })
      .catch((e) => { console.error('[App] GTFS error:', e); setChip('Ошибка загрузки данных'); });
  }, [lang, splash]);

  const [panelOpen, setPanelOpen] = useState(false);
  const isMobile = window.innerWidth < 768;

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
        ? <BottomSheet open={panelOpen} onClose={() => setPanelOpen(false)} />
        : <Sidebar open={panelOpen} onClose={() => setPanelOpen(false)} />
      }

      {/* FAB кнопки */}
      <TiltButton />
      <SearchBar onOpenPanel={() => setPanelOpen(true)} />
      <PlannerButton />
      <FeedButton onOpen={() => setPanelOpen(true)} />
      <LocateButton />

      {/* Попапы */}
      <StopPopup />

      {/* Уведомления */}
      <Chip />
    </div>
  );
}
