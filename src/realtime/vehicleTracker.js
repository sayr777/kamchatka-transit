import { useAppStore } from '../store/appStore';
import { t } from '../i18n';
import { bearingFromDelta } from '../utils/bearing';
import { samplePath, shapePointsToPath } from '../utils/routePath';
import { normalizeVehicles } from '../utils/vehicleVisibility';

const RECONNECT_DELAY = 5000;
const UPDATE_THROTTLE = 1000;

let ws = null;
let reconnectTimer = null;
let lastUpdate = 0;
let pendingVehicles = null;
let flushTimer = null;
let stopSimulation = null;
const prevPosById = new Map();

function publishVehicles(vehicles) {
  useAppStore.setState((prev) => ({
    vehicles,
    vehicleTick: prev.vehicleTick + 1,
  }));
}

function flushPending() {
  if (!pendingVehicles) return;
  publishVehicles(pendingVehicles);
  pendingVehicles = null;
  flushTimer = null;
}

function ingestVehicles(rawList) {
  const { tripToRoute, routeMetaById, vehicleTypeById } = useAppStore.getState();
  const vehicles = normalizeVehicles(
    (rawList || []).map((v) => {
      const id = v.id || v.vehicle_id;
      const lon = parseFloat(v.lon || v.longitude);
      const lat = parseFloat(v.lat || v.latitude);
      let bearing = parseFloat(v.bearing ?? v.course ?? NaN);
      const prev = prevPosById.get(id);
      if (!Number.isFinite(bearing) && prev) {
        bearing = bearingFromDelta(lon - prev.lon, lat - prev.lat) ?? prev.bearing ?? 0;
      } else if (!Number.isFinite(bearing)) {
        bearing = 0;
      }
      prevPosById.set(id, { lon, lat, bearing });
      return {
        id,
        lon,
        lat,
        bearing,
        routeId: v.route_id || v.routeId || null,
        tripId: v.trip_id || v.tripId || null,
        label: v.label || v.route_short_name || '',
        speed: parseFloat(v.speed || 0),
        updatedAt: v.timestamp || Date.now(),
      };
    }),
    tripToRoute,
    routeMetaById,
    vehicleTypeById,
  );

  pendingVehicles = vehicles;
  if (!flushTimer) {
    const now = Date.now();
    const wait = Math.max(0, UPDATE_THROTTLE - (now - lastUpdate));
    flushTimer = setTimeout(() => { lastUpdate = Date.now(); flushPending(); }, wait);
  }
}

function onMessage(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return; }
  const list = data.vehicles || data.items || [];
  console.log(`[RT] ${list.length} vehicles received`);
  ingestVehicles(list);
}

function connect(url) {
  if (ws) return;
  console.log(`[RT] connecting: ${url}`);
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[RT] connected ✓');
    const lang = useAppStore.getState().lang;
    useAppStore.getState().setChip(t('rt.connected', lang), 2000);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onmessage = (e) => onMessage(e.data);
  ws.onerror = (e) => console.error('[RT] ws error', e);

  ws.onclose = (e) => {
    console.warn(`[RT] disconnected (code ${e.code}), reconnect in ${RECONNECT_DELAY}ms`);
    ws = null;
    reconnectTimer = setTimeout(() => connect(url), RECONNECT_DELAY);
  };
}

function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (stopSimulation) { stopSimulation(); stopSimulation = null; }
  if (ws) { ws.close(); ws = null; }
}

function buildPathSimVehicles(allRoutes, firstShapeByRoute, shapesByShapeId, routeMetaById) {
  const simVehicles = [];
  const seenRoute = new Set();

  for (const r of allRoutes) {
    if (seenRoute.has(r.route_id)) continue;
    seenRoute.add(r.route_id);

    const shapeId = firstShapeByRoute?.get?.(r.route_id);
    const pts = shapeId ? shapesByShapeId?.get?.(shapeId) : null;
    const path = shapePointsToPath(pts);
    if (path.length < 2) continue;

    const meta = routeMetaById.get(r.route_id);
    const slots = path.length > 120 ? 2 : 1;
    for (let slot = 0; slot < slots; slot++) {
      simVehicles.push({
        id: `sim-${r.route_id}${slot ? `-${slot}` : ''}`,
        routeId: r.route_id,
        label: meta?.shortName || r.route_short_name || r.route_id,
        path,
        pathT: (slot / slots + Math.random() * 0.35) % 1,
        pathSpeed: 0.00045 + Math.random() * 0.00035,
        pathDir: Math.random() > 0.5 ? 1 : -1,
      });
    }
    if (simVehicles.length >= 40) break;
  }

  return simVehicles;
}

function startSimulation() {
  if (stopSimulation) return stopSimulation;
  console.log('[RT] WebSocket недоступен — запуск офлайн-симуляции');

  const tick = () => {
    const { allRoutes, routeMetaById, firstShapeByRoute, shapesByShapeId } = useAppStore.getState();
    if (!allRoutes?.length) return;

    if (!startSimulation._fleet?.length) {
      startSimulation._fleet = buildPathSimVehicles(
        allRoutes,
        firstShapeByRoute,
        shapesByShapeId,
        routeMetaById,
      );
      console.log(`[RT] simulation: ${startSimulation._fleet.length} vehicles on shapes`);
      if (!startSimulation._fleet.length) return;
    }

    const published = startSimulation._fleet.map((v) => {
      const pathT = (v.pathT + v.pathSpeed * v.pathDir + 1) % 1;
      v.pathT = pathT;
      const pos = samplePath(v.path, pathT);
      if (!pos) return null;
      return {
        id: v.id,
        routeId: v.routeId,
        label: v.label,
        lon: pos.lon,
        lat: pos.lat,
        bearing: pos.bearing,
        speed: 18 + Math.random() * 8,
        updatedAt: Date.now(),
      };
    }).filter(Boolean);

    publishVehicles(published);
  };

  const interval = setInterval(tick, 1000);
  tick();
  const stop = () => {
    clearInterval(interval);
    startSimulation._fleet = null;
  };
  stopSimulation = stop;
  return stop;
}

export function startVehicleTracker(wsUrl) {
  if (wsUrl) {
    connect(wsUrl);
    setTimeout(() => {
      if (!useAppStore.getState().vehicles.length) {
        console.warn('[RT] no data from WS after 10s, starting simulation');
        startSimulation();
      }
    }, 10000);
  } else {
    startSimulation();
  }
  return disconnect;
}