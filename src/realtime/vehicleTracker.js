import { useAppStore } from '../store/appStore';

const RECONNECT_DELAY = 5000;
const UPDATE_THROTTLE = 1000; // мин. интервал между обновлениями store (мс)

let ws = null;
let reconnectTimer = null;
let lastUpdate = 0;
let pendingVehicles = null;
let flushTimer = null;

function flushPending() {
  if (!pendingVehicles) return;
  useAppStore.setState({ vehicles: pendingVehicles });
  pendingVehicles = null;
  flushTimer = null;
}

function onMessage(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return; }

  const vehicles = (data.vehicles || data.items || []).map(v => ({
    id: v.id || v.vehicle_id,
    lon: parseFloat(v.lon || v.longitude),
    lat: parseFloat(v.lat || v.latitude),
    bearing: parseFloat(v.bearing || v.course || 0),
    routeId: v.route_id || v.routeId || null,
    label: v.label || v.route_short_name || '',
    speed: parseFloat(v.speed || 0),
    updatedAt: v.timestamp || Date.now(),
  })).filter(v => v.lon && v.lat);

  console.log(`[RT] ${vehicles.length} vehicles received`);

  // Throttle: накапливаем обновления, сбрасываем через UPDATE_THROTTLE
  pendingVehicles = vehicles;
  if (!flushTimer) {
    const now = Date.now();
    const wait = Math.max(0, UPDATE_THROTTLE - (now - lastUpdate));
    flushTimer = setTimeout(() => { lastUpdate = Date.now(); flushPending(); }, wait);
  }
}

function connect(url) {
  if (ws) return;
  console.log(`[RT] connecting: ${url}`);
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[RT] connected ✓');
    useAppStore.getState().setChip('Реалтайм подключён', 2000);
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
  if (ws) { ws.close(); ws = null; }
}

// ── GTFS-RT симуляция (fallback когда нет WS) ─────────────
function startSimulation() {
  console.log('[RT] WebSocket недоступен — запуск офлайн-симуляции');

  const { allStops, allRoutes, routeMetaById } = useAppStore.getState();
  if (!allStops?.length || !allRoutes?.length) {
    setTimeout(startSimulation, 3000);
    return;
  }

  const PKC = { lon: 158.7, lat: 53.015 };
  const simVehicles = allRoutes.slice(0, 30).map((r, i) => {
    const angle = (i / 30) * Math.PI * 2;
    const radius = 0.02 + Math.random() * 0.04;
    const meta = routeMetaById.get(r.route_id);
    return {
      id: `sim-${r.route_id}`,
      lon: PKC.lon + Math.cos(angle) * radius,
      lat: PKC.lat + Math.sin(angle) * radius * 0.6,
      bearing: (angle * 180 / Math.PI + 90) % 360,
      routeId: r.route_id,
      label: meta?.shortName || r.route_id,
      speed: 20 + Math.random() * 20,
      _dLon: Math.cos(angle + Math.PI / 2) * 0.00005,
      _dLat: Math.sin(angle + Math.PI / 2) * 0.00003,
    };
  });

  const tick = () => {
    for (const v of simVehicles) {
      v.lon += v._dLon;
      v.lat += v._dLat;
      // Bounce inside bbox
      if (Math.abs(v.lon - PKC.lon) > 0.08) v._dLon *= -1;
      if (Math.abs(v.lat - PKC.lat) > 0.05) v._dLat *= -1;
    }
    useAppStore.setState({ vehicles: [...simVehicles] });
  };

  const interval = setInterval(tick, 2000);
  console.log(`[RT] simulation: ${simVehicles.length} vehicles`);
  return () => clearInterval(interval);
}

// ── Публичный API ─────────────────────────────────────────
export function startVehicleTracker(wsUrl) {
  if (wsUrl) {
    connect(wsUrl);
    // Fallback: если через 10 сек нет данных — симуляция
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
