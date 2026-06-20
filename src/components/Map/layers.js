import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';

function dynSizes(zoom) {
  const z = zoom ?? 12;
  const lineW = Math.max(3, Math.min(10, 2 + (z - 10) * 0.9));
  const busR = lineW + 4;
  const busHaloR = busR + 6;
  const stopR = lineW + 2;
  return { lineW, busR, busHaloR, stopR };
}

function hexToRgb(hex) {
  const h = (hex || '#1e78d0').replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function routeRgb(vehicle, routeMetaById) {
  const m = routeMetaById?.get(vehicle.routeId);
  return hexToRgb(m?.hex);
}

// Viewport bbox для фильтрации объектов вне экрана
function inViewport(lon, lat, s) {
  if (!s.viewState) return true;
  const { longitude, latitude, zoom } = s.viewState;
  const deg = 360 / Math.pow(2, zoom) * 3; // ~3 экрана запас
  return Math.abs(lon - longitude) < deg && Math.abs(lat - latitude) < deg * 0.6;
}

// Стабильный comparator: не пересоздаём GPU-буферы если длина не изменилась
const lenComparator = (a, b) => a.length === b.length;

export function buildLayers(s, onStopClick) {
  const layers = [];
  const sz = dynSizes(s.zoom);
  const F = { fontFamily: 'Arial,sans-serif', fontWeight: 'bold', billboard: true, background: false, getTextAnchor: 'middle', getAlignmentBaseline: 'bottom' };

  // ── Остановки (только при zoom ≥ 13) ───────────────
  if (s.zoom >= 13 && s.allStops?.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'stops',
        data: s.allStops,
        pickable: true,
        getPosition: (d) => [parseFloat(d.stop_lon), parseFloat(d.stop_lat)],
        getRadius: 1,
        radiusMinPixels: sz.stopR,
        getFillColor: (d) => d.stop_id === s.activeStopId ? [252, 63, 29, 255] : [255, 255, 255, 240],
        getLineColor: (d) => d.stop_id === s.activeStopId ? [180, 30, 10, 255] : [80, 80, 80, 200],
        lineWidthMinPixels: 2,
        stroked: true, filled: true,
        dataComparator: lenComparator,
        updateTriggers: { getFillColor: s.activeStopId, getLineColor: s.activeStopId },
        onClick: onStopClick,
      })
    );
  }

  // ── Геолокация ──────────────────────────────────────
  if (s.userLocation) {
    layers.push(
      new ScatterplotLayer({ id: 'user-halo', data: [s.userLocation], getPosition: d => [d.lon, d.lat], getRadius: 1, radiusMinPixels: 18, getFillColor: [37, 99, 235, 35], filled: true }),
      new ScatterplotLayer({ id: 'user-dot',  data: [s.userLocation], getPosition: d => [d.lon, d.lat], getRadius: 1, radiusMinPixels: 8, getFillColor: [37, 99, 235, 255], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 3, stroked: true, filled: true }),
    );
  }

  // ── Режим без активного маршрута ────────────────────
  if (!s.route || !s.tripsData) {
    // Viewport filtering — рендерим только видимые ТС
    const visible = s.vehicles.filter(v =>
      v.routeId && inViewport(v.lon, v.lat, s)
    );
    if (visible.length) {
      layers.push(
        new TextLayer({
          id: 'rt-over-num', data: visible,
          getPosition: d => [d.lon, d.lat],
          getText: d => d.label || '',
          getSize: 12,
          getColor: [255, 255, 255, 255],
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'bottom',
          getPixelOffset: [0, -4],
          background: true,
          getBackgroundColor: d => [...routeRgb(d, s.routeMetaById), 230],
          backgroundPadding: [6, 4, 6, 4],
          characterSet: Array.from('0123456789АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяёЁ '),
          sizeMinPixels: 10, sizeMaxPixels: 14,
          parameters: { depthTest: false },
          dataComparator: lenComparator,
          updateTriggers: { getText: s.vehicles.length, getBackgroundColor: s.vehicles.length },
        }),
        new ScatterplotLayer({
          id: 'rt-over-dot', data: visible, pickable: true,
          getPosition: d => [d.lon, d.lat],
          getRadius: 1,
          radiusMinPixels: 5, radiusMaxPixels: 8,
          getFillColor: d => routeRgb(d, s.routeMetaById),
          getLineColor: [255, 255, 255, 255],
          lineWidthMinPixels: 1.5,
          stroked: true, filled: true,
          parameters: { depthTest: false },
          dataComparator: lenComparator,
          updateTriggers: { getFillColor: s.vehicles.length },
        }),
      );
    }
    return layers;
  }

  // ── Активный маршрут ────────────────────────────────
  const [r, g, b] = s.route.color ?? [30, 120, 210];

  layers.push(
    new PathLayer({ id: 'rs', data: [{ path: s.shapePath }], getPath: d => d.path, getColor: [r,g,b,25], getWidth: 8, widthMinPixels: Math.round(sz.lineW*1.4), rounded: true, capRounded: true }),
    new PathLayer({ id: 'rl', data: [{ path: s.shapePath }], getPath: d => d.path, getColor: [r,g,b,230], getWidth: 4, widthMinPixels: Math.round(sz.lineW), rounded: true, capRounded: true }),
  );

  const visible = s.vehicles.filter(v => v.routeId === s.route?.id);
  if (visible.length) {
    layers.push(
      new ScatterplotLayer({ id: 'rth', data: visible, getPosition: d => [d.lon, d.lat], getRadius: 1, radiusMinPixels: sz.busHaloR + 6, getFillColor: d => d.id === s.selectedVehicleId ? [255,185,30,60] : [r,g,b,30], filled: true }),
      new ScatterplotLayer({ id: 'rtv-dot', data: visible, pickable: true, getPosition: d => [d.lon, d.lat], getRadius: 1, radiusMinPixels: sz.busR, getFillColor: d => d.id === s.selectedVehicleId ? [245,170,10] : [r,g,b], getLineColor: [255,255,255,220], lineWidthMinPixels: 2, stroked: true, filled: true }),
      new TextLayer({ ...F, id: 'rt1', data: visible, pickable: true, getPosition: d => [d.lon, d.lat], getText: d => d.label||'', getSize: 11, getColor: [255,255,255,255], getPixelOffset: [0, -(sz.busR + 6)], background: true, getBackgroundColor: d => d.id === s.selectedVehicleId ? [245,170,10,240] : [r,g,b,230], backgroundPadding: [5,2,5,2], getBorderRadius: 4, sizeMaxPixels: 14, sizeMinPixels: 10 }),
    );
  }

  return layers;
}
