import { create } from 'zustand';
import { getRouteIdsForStop } from '../utils/stopFocus';
import {
  computePlannerRoute,
  makePlannerPoint,
  plannerBoundsFromResult,
} from '../utils/planner';
import { t } from '../i18n';
import {
  loadFavoriteStopIds,
  loadFavoriteRouteIds,
  saveFavoriteStopIds,
  saveFavoriteRouteIds,
  toggleFavoriteId,
} from '../utils/favorites';

const PKC = { lon: 158.700, lat: 53.015 };

export const useAppStore = create((set, get) => ({
  // ── Карта ──────────────────────────────────────────
  viewState: { longitude: PKC.lon, latitude: PKC.lat, zoom: 12.5, pitch: 0, bearing: 0 },
  zoom: 12.5,
  setViewState: (viewState) => set({ viewState, zoom: viewState.zoom }),

  // ── Язык / фид ─────────────────────────────────────
  lang: localStorage.getItem('kamchatka.transport.lang') || 'ru',
  setLang: (lang) => { localStorage.setItem('kamchatka.transport.lang', lang); set({ lang }); },

  // ── GTFS данные ─────────────────────────────────────
  allStops: [],
  allRoutes: [],
  routeMetaById: new Map(),
  routeContextById: new Map(),
  arrivalsByStopId: new Map(),
  tripToService: new Map(),
  tripToRoute: new Map(),
  tripMetaById: new Map(),
  frequenciesByTripId: new Map(),
  tripFirstDepMinByTripId: new Map(),
  calendarByServiceId: new Map(),
  shapesByShapeId: new Map(),
  firstShapeByRoute: new Map(),
  stopIdsByRouteId: new Map(),
  routeIdsByStopId: new Map(),
  routeConditionsById: new Map(),
  vehicleTypeById: new Map(),
  plannerAdjacency: new Map(),
  gtfsReady: false,
  setGtfsData: (data) => set({ ...data, gtfsReady: true }),

  // ── Текущий вид ─────────────────────────────────────
  stops: [],            // остановки в текущем bbox
  route: null,          // выбранный маршрут { id, color, meta }
  shapePath: [],
  tripsData: null,
  activeStopId: null,
  stopFocus: null, // { stop, routeIds }
  focusGuardUntil: 0,
  selectStop: (stop) => {
    if (!stop) {
      set({ stopFocus: null, activeStopId: null });
      return;
    }
    const { routeIdsByStopId, arrivalsByStopId } = get();
    const routeIds = getRouteIdsForStop(stop.stop_id, routeIdsByStopId, arrivalsByStopId);
    set({
      stopFocus: { stop, routeIds },
      activeStopId: stop.stop_id,
      route: null,
      shapePath: [],
      tripsData: null,
      focusGuardUntil: Date.now() + 500,
    });
  },
  clearStopFocus: () => set({ stopFocus: null, activeStopId: null }),
  setActiveRoute: (routeId) => {
    if (!routeId) {
      set({ route: null, shapePath: [], tripsData: null });
      return;
    }
    const { routeMetaById, firstShapeByRoute, shapesByShapeId } = get();
    const meta = routeMetaById.get(routeId);
    const shapeId = firstShapeByRoute.get(routeId);
    const coords = shapeId ? (shapesByShapeId.get(shapeId) || []) : [];
    const shapePath = coords.map(p => [parseFloat(p.shape_pt_lon ?? p.lon ?? p[0]), parseFloat(p.shape_pt_lat ?? p.lat ?? p[1])]);
    const hex = (meta?.hex || '#1e78d0').replace('#', '');
    const color = [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
    set({
      route: { id: routeId, color, meta },
      shapePath,
      tripsData: true,
      stopFocus: null,
      activeStopId: null,
      selectedVehicleId: null,
      followVehicleId: null,
      focusGuardUntil: Date.now() + 500,
    });
  },
  clearRoute: () => set({
    route: null,
    shapePath: [],
    tripsData: null,
    selectedVehicleId: null,
    followVehicleId: null,
  }),

  // ── Реалтайм ────────────────────────────────────────
  vehicles: [],
  vehicleTick: 0,
  selectedVehicleId: null,
  followVehicleId: null,
  currentTime: 0,
  animSpeed: 1,
  paused: false,
  setVehicles: (vehicles) => set({ vehicles }),
  selectVehicle: (id) => set({ selectedVehicleId: id, followVehicleId: id }),

  // ── Геолокация ──────────────────────────────────────
  userLocation: null,
  setUserLocation: (loc) => set({ userLocation: loc }),

  // ── Погода (Yandex Weather API) ─────────────────────
  weather: null,
  weatherStatus: 'idle', // idle | loading | ready | error | unconfigured
  weatherError: null,
  weatherDisabled: false,
  setWeather: (weather) => set({ weather, weatherStatus: 'ready', weatherError: null }),

  // ── Избранное ───────────────────────────────────────
  favoriteStopIds: loadFavoriteStopIds(),
  favoriteRouteIds: loadFavoriteRouteIds(),
  isFavoriteStop: (stopId) => get().favoriteStopIds.includes(stopId),
  isFavoriteRoute: (routeId) => get().favoriteRouteIds.includes(routeId),
  toggleFavoriteStop: (stopId) => {
    if (!stopId) return false;
    const { ids, added } = toggleFavoriteId(get().favoriteStopIds, stopId);
    saveFavoriteStopIds(ids);
    set({ favoriteStopIds: ids });
    return added;
  },
  toggleFavoriteRoute: (routeId) => {
    if (!routeId) return false;
    const { ids, added } = toggleFavoriteId(get().favoriteRouteIds, routeId);
    saveFavoriteRouteIds(ids);
    set({ favoriteRouteIds: ids });
    return added;
  },

  // ── Поиск ───────────────────────────────────────────
  searchOpen: false,
  searchQuery: '',
  setSearchOpen: (v) => set({ searchOpen: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  // ── Планировщик ─────────────────────────────────────
  plannerOpen: false,
  plannerFrom: null,
  plannerTo: null,
  plannerResult: null,
  plannerError: '',
  plannerPickMode: null,
  setPlannerOpen: (v) => set({ plannerOpen: v }),
  setPlannerPickMode: (mode) => set((s) => ({
    plannerPickMode: s.plannerPickMode === mode ? null : mode,
    plannerOpen: true,
  })),
  togglePlanner: () => {
    const s = get();
    if (s.plannerOpen) {
      set({ plannerOpen: false, plannerPickMode: null });
      return;
    }
    let pickMode = null;
    if (!s.plannerFrom) pickMode = 'from';
    else if (!s.plannerTo) pickMode = 'to';
    set({ plannerOpen: true, plannerPickMode: pickMode });
  },
  setPlannerLonLat: (target, lon, lat, meta = {}) => {
    const state = get();
    const actual = target || state.plannerPickMode || (!state.plannerFrom ? 'from' : 'to');
    const { allStops, lang } = state;
    const point = makePlannerPoint(lon, lat, allStops, meta);
    const next = {
      [actual === 'from' ? 'plannerFrom' : 'plannerTo']: point,
      plannerResult: null,
      plannerError: '',
      focusGuardUntil: Date.now() + 500,
    };
    if (state.plannerPickMode === actual) {
      next.plannerPickMode = actual === 'from' ? 'to' : null;
    }
    set(next);
    const after = get();
    if (after.plannerFrom && after.plannerTo) after.runPlanner();
  },
  setPlannerFromStop: (target, stop) => {
    if (!stop) return;
    get().setPlannerLonLat(target, parseFloat(stop.stop_lon), parseFloat(stop.stop_lat), {
      source: 'stop',
      stopId: stop.stop_id,
      stopName: stop.stop_name || stop.name,
    });
  },
  usePlannerMyLocation: () => {
    const loc = get().userLocation;
    if (!loc) {
      set({ plannerError: 'locate.unavailable', plannerOpen: true });
      return;
    }
    get().setPlannerLonLat('from', loc.lon, loc.lat, { source: 'user' });
  },
  clearPlanner: () => set({
    plannerFrom: null,
    plannerTo: null,
    plannerResult: null,
    plannerError: '',
    plannerPickMode: null,
  }),
  runPlanner: () => {
    const { plannerFrom, plannerTo, plannerAdjacency, allStops, lang } = get();
    const pointLabel = t('planner.pointOnMap', lang);
    const out = computePlannerRoute(plannerFrom, plannerTo, plannerAdjacency, allStops, pointLabel);
    if (out.error) {
      set({ plannerResult: null, plannerError: `planner.${out.error}` });
      return null;
    }
    set({ plannerResult: out.result, plannerError: '', plannerPickMode: null });
    return { result: out.result, bounds: plannerBoundsFromResult(out.result) };
  },

  // ── UI ──────────────────────────────────────────────
  splash: !localStorage.getItem('kamchatka.transport.lang'),
  setSplash: (v) => set({ splash: v }),
  chip: '',
  setChip: (msg, ms = 2500) => {
    set({ chip: msg });
    setTimeout(() => set((s) => s.chip === msg ? { chip: '' } : {}), ms);
  },
  popup: null,
  setPopup: (popup) => set({ popup }),
  closePopup: () => set({ popup: null }),
}));
