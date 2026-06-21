import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useAppStore } from '../../store/appStore';
import { t } from '../../i18n';
import { buildLayers } from './layers';
import { precacheRegionTiles } from '../../gtfs/precache';
import styles from './MapView.module.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW50b24wNjEyIiwiYSI6ImNtcWltNWt2NzAwNW0ydHM5eXlkcGZ6cjAifQ.8PaloVhi21MZLJfuFNIibA';

const RASTER_STYLE = {
  version: 8,
  sources: {
    mapbox: {
      type: 'raster',
      tileSize: 256,
      attribution: '© Mapbox',
      tiles: [
        `https://api.mapbox.com/styles/v1/anton0612/cmqinytnv001z01pmbzqogxpa/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
      ],
    },
  },
  layers: [{ id: 'mapbox-tiles', type: 'raster', source: 'mapbox' }],
};

export default function MapView({ onMapClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);

  const setViewState = useAppStore((s) => s.setViewState);
  const closePopup = useAppStore((s) => s.closePopup);
  const setChip = useAppStore((s) => s.setChip);
  const setActiveRoute = useAppStore((s) => s.setActiveRoute);
  const clearRoute = useAppStore((s) => s.clearRoute);

  // Храним ссылку на store для анимационного цикла без ре-рендеров
  const storeRef = useRef(useAppStore.getState());
  useEffect(() => useAppStore.subscribe((s) => { storeRef.current = s; }), []);

  const handleStopClick = useCallback((info) => {
    if (!info.object) return;
    const stop = info.object;
    const store = useAppStore.getState();
    if (store.plannerPickMode) {
      store.setPlannerFromStop(store.plannerPickMode, stop);
      return;
    }
    store.selectStop(stop);
    store.setPopup({
      type: 'stop',
      stop,
      x: info.x,
      y: info.y,
    });
    MapView.flyTo({
      longitude: parseFloat(stop.stop_lon),
      latitude: parseFloat(stop.stop_lat),
      zoom: 15,
      transitionDuration: 600,
    });
  }, []);

  const handleVehicleClick = useCallback((vehicle) => {
    if (!vehicle?.routeId) return;
    const store = useAppStore.getState();
    store.selectVehicle(vehicle.id);
    store.setActiveRoute(vehicle.routeId);
    MapView.flyTo({
      longitude: vehicle.lon,
      latitude: vehicle.lat,
      zoom: Math.max(store.zoom || 12, 14),
      transitionDuration: 550,
    });
  }, []);

  // Ref позволяет useEffect всегда вызывать актуальный обработчик без пересоздания overlay
  const vehicleClickRef = useRef(handleVehicleClick);
  vehicleClickRef.current = handleVehicleClick;

  const handleMapClick = useCallback((info) => {
    const store = useAppStore.getState();
    if (store.plannerPickMode && info.coordinate) {
      const [lon, lat] = info.coordinate;
      store.setPlannerLonLat(store.plannerPickMode, lon, lat);
      return;
    }
    if (!info.object) {
      if (Date.now() < store.focusGuardUntil) return;
      if (store.plannerOpen) return;
      store.closePopup();
      store.clearStopFocus();
      store.clearRoute();
    }
    onMapClick?.(info);
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    console.log('[Map] initializing MapLibre GL');
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: RASTER_STYLE,
      center: [158.700, 53.015],
      zoom: 12.5,
      pitch: 0,
      bearing: 0,
      maxPitch: 60,
      attributionControl: false,
    });
    mapRef.current = map;

    const overlay = new MapboxOverlay({
      interleaved: false,
      useDevicePixels: window.devicePixelRatio > 1 ? 1.5 : 1, // cap DPR для мобильных
      layers: [],
      parameters: { depthTest: false },
      onClick: (info) => {
        const lid = info.layer?.id || '';
        if (lid === 'stops') return; // handled by ScatterplotLayer onClick
        if (lid.endsWith('-veh-icons') && info.object) {
          vehicleClickRef.current(info.object);
          return;
        }
        handleMapClick(info);
      },
    });
    overlayRef.current = overlay;
    map.addControl(overlay);
    console.log('[Map] deck.gl MapboxOverlay attached');

    map.once('load', () => {
      console.log('[Map] loaded ✓');
      setTimeout(() => {
        console.log('[Precache] starting PKC tile precache...');
        precacheRegionTiles((done, total) => {
          if (done % 200 === 0 || done === total)
            console.log(`[Precache] ${done}/${total} tiles`);
        }).then(n => console.log(`[Precache] done — ${n} tiles cached`));
      }, 5000);
    });

    map.on('dragstart', () => {
      closePopup();
      const { followVehicleId, setChip: chip, lang } = storeRef.current;
      if (followVehicleId) {
        useAppStore.setState({ followVehicleId: null });
        chip(t('rt.tracking.off', lang));
      }
    });

    map.on('move', () => {
      const c = map.getCenter();
      setViewState({
        longitude: c.lng,
        latitude: c.lat,
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    });

    // Анимационный цикл — 60fps для времени, 30fps для deck.gl слоёв
    let rafId;
    let lastTs = null;
    let lastLayerUpdate = 0;
    const LAYER_INTERVAL = 1000 / 30; // deck.gl обновляется макс 30fps

    // FPS счётчик (только в dev)
    let fpsFrames = 0, fpsLast = 0;
    const DEV = import.meta.env.DEV;

    const loop = (ts) => {
      const s = storeRef.current;
      let delta = 0;
      if (!s.paused) {
        if (lastTs !== null) delta = ts - lastTs;
        lastTs = ts;
        if (delta > 0) {
          useAppStore.setState((prev) => ({
            currentTime: prev.currentTime + delta * 0.12 * prev.animSpeed,
          }));
        }
      } else {
        lastTs = ts;
      }

      // Обновляем слои не чаще 30fps
      if (ts - lastLayerUpdate >= LAYER_INTERVAL) {
        overlayRef.current?.setProps({ layers: buildLayers(storeRef.current, handleStopClick) });
        lastLayerUpdate = ts;
      }

      if (s.followVehicleId && mapRef.current) {
        const tracked = s.vehicles.find((v) => v.id === s.followVehicleId);
        if (tracked) {
          mapRef.current.easeTo({
            center: [tracked.lon, tracked.lat],
            duration: 280,
            essential: true,
          });
        }
      }

      if (DEV) {
        fpsFrames++;
        if (ts - fpsLast >= 1000) {
          console.debug(`[FPS] ${fpsFrames} fps | vehicles: ${s.vehicles.length} | stops: ${s.allStops?.length ?? 0}`);
          fpsFrames = 0; fpsLast = ts;
        }
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      map.remove();
    };
  }, []);

  // Публичный API для внешнего управления камерой
  MapView.flyTo = (opts) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({
      center: [opts.longitude ?? map.getCenter().lng, opts.latitude ?? map.getCenter().lat],
      zoom: opts.zoom ?? map.getZoom(),
      pitch: opts.pitch ?? map.getPitch(),
      bearing: opts.bearing ?? map.getBearing(),
      duration: opts.transitionDuration ?? 500,
    });
  };

  MapView.getMap = () => mapRef.current;

  return <div ref={containerRef} className={styles.map} />;
}
