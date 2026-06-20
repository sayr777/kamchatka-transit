import { create } from 'zustand';

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
  calendarByServiceId: new Map(),
  shapesByShapeId: new Map(),
  firstShapeByRoute: new Map(),
  gtfsReady: false,
  setGtfsData: (data) => set({ ...data, gtfsReady: true }),

  // ── Текущий вид ─────────────────────────────────────
  stops: [],            // остановки в текущем bbox
  route: null,          // выбранный маршрут { id, color, meta }
  shapePath: [],
  tripsData: null,
  activeStopId: null,
  setActiveStop: (id) => set({ activeStopId: id }),
  setActiveRoute: (routeId) => {
    if (!routeId) { set({ route: null, shapePath: [], tripsData: null }); return; }
    const { routeMetaById, firstShapeByRoute, shapesByShapeId } = get();
    const meta = routeMetaById.get(routeId);
    const shapeId = firstShapeByRoute.get(routeId);
    const coords = shapeId ? (shapesByShapeId.get(shapeId) || []) : [];
    const shapePath = coords.map(p => [parseFloat(p.lon ?? p[0]), parseFloat(p.lat ?? p[1])]);
    const hex = (meta?.hex || '#1e78d0').replace('#', '');
    const color = [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
    set({ route: { id: routeId, color, meta }, shapePath, tripsData: true });
  },
  clearRoute: () => set({ route: null, shapePath: [], tripsData: null }),

  // ── Реалтайм ────────────────────────────────────────
  vehicles: [],
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
  plannerPickMode: null,
  setPlannerOpen: (v) => set({ plannerOpen: v }),
  setPlannerPoint: (side, point) => set(side === 'from' ? { plannerFrom: point } : { plannerTo: point }),
  clearPlanner: () => set({ plannerFrom: null, plannerTo: null, plannerResult: null }),

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
