import { PathLayer, ScatterplotLayer, TextLayer, IconLayer } from '@deck.gl/layers';
import { getVehicleIconUrl, resolveVehicleIconType } from './vehicleIcons';
import { buildRoutePathEntries, collectStopsForRoutes } from '../../utils/stopFocus';
import { hexRgb } from '../../utils/geo';
import { getFocusedRouteIds, getVisibleVehicles } from '../../utils/vehicleVisibility';

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
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function routeRgb(vehicle, routeMetaById) {
  const m = routeMetaById?.get(vehicle.routeId);
  return hexToRgb(m?.hex);
}

const lenComparator = (a, b) => a.length === b.length;

function appendPathLayers(layers, entries, sz, prefix) {
  if (!entries.length) return;
  layers.push(
    new PathLayer({
      id: `${prefix}-shadow`,
      data: entries,
      getPath: (d) => d.path,
      getColor: (d) => [...d.color, 25],
      getWidth: 8,
      widthMinPixels: Math.round(sz.lineW * 1.4),
      rounded: true,
      capRounded: true,
    }),
    new PathLayer({
      id: `${prefix}-line`,
      data: entries,
      getPath: (d) => d.path,
      getColor: (d) => [...d.color, 220],
      getWidth: 4,
      widthMinPixels: Math.round(sz.lineW),
      rounded: true,
      capRounded: true,
    }),
  );
}

function vehicleAccentRgb(vehicle, s, accentRgb) {
  if (accentRgb?.length >= 3) return accentRgb.slice(0, 3);
  return routeRgb(vehicle, s.routeMetaById);
}

function appendVehicleLayers(layers, vehicles, s, sz, F, prefix, opts = {}) {
  if (!vehicles.length) return;
  const routeFocus = !!opts.routeFocus;
  const accentRgb = opts.accentRgb;
  const iconScale = routeFocus ? 1.12 : 1;
  const iconSize = Math.max(28, sz.busR * 3.2) * iconScale;
  const selectedId = s.selectedVehicleId;

  layers.push(
    new ScatterplotLayer({
      id: `${prefix}-veh-halo`,
      data: vehicles,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: 1,
      radiusMinPixels: (d) => {
        const base = iconSize * (d.id === selectedId ? 0.72 : 0.55);
        return routeFocus && d.id === selectedId ? base + 8 : base;
      },
      getFillColor: (d) => {
        const [r, g, b] = vehicleAccentRgb(d, s, accentRgb);
        return d.id === selectedId ? [255, 185, 30, routeFocus ? 72 : 55] : [r, g, b, routeFocus ? 42 : 28];
      },
      getLineColor: (d) => (d.id === selectedId ? [255, 214, 64, 210] : [0, 0, 0, 0]),
      getLineWidth: (d) => (d.id === selectedId ? 4 : 0),
      filled: true,
      stroked: true,
      parameters: { depthTest: false },
      dataComparator: lenComparator,
      updateTriggers: { getFillColor: [selectedId, routeFocus], getRadius: selectedId },
    }),
    new IconLayer({
      id: `${prefix}-veh-icons`,
      data: vehicles,
      pickable: true,
      getPosition: (d) => [d.lon, d.lat],
      getIcon: (d) => {
        const meta = s.routeMetaById?.get(d.routeId);
        const [r, g, b] = vehicleAccentRgb(d, s, accentRgb);
        const hex = meta?.hex || `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        const routeType = d.routeType ?? resolveVehicleIconType(meta, d);
        return {
          url: getVehicleIconUrl(routeType, hex),
          width: 40,
          height: 64,
          anchorX: 20,
          anchorY: 32,
          mask: false,
        };
      },
      getSize: (d) => iconSize + (d.id === selectedId ? 4 : 0),
      sizeUnits: 'pixels',
      getAngle: (d) => d.bearing || 0,
      billboard: false,
      alphaCutoff: 0.05,
      parameters: { depthTest: false },
      updateTriggers: {
        getIcon: [s.vehicleTick, selectedId, routeFocus],
        getSize: [sz.busR, selectedId, routeFocus],
        getAngle: s.vehicleTick,
        getPosition: s.vehicleTick,
      },
    }),
    new TextLayer({
      ...F,
      id: `${prefix}-veh-label-shadow`,
      data: vehicles,
      getPosition: (d) => [d.lon, d.lat],
      getText: (d) => d.label || '',
      getSize: routeFocus ? 13 : 11,
      getColor: [255, 255, 255, 255],
      getPixelOffset: [0, -(iconSize * 0.55 + 6)],
      background: true,
      getBackgroundColor: (d) => {
        const [r, g, b] = vehicleAccentRgb(d, s, accentRgb);
        return d.id === selectedId ? [245, 170, 10, 255] : [r, g, b, routeFocus ? 245 : 230];
      },
      backgroundPadding: [5, 2, 5, 2],
      getBorderRadius: 4,
      sizeMaxPixels: routeFocus ? 16 : 14,
      sizeMinPixels: routeFocus ? 11 : 10,
      parameters: { depthTest: false },
      dataComparator: lenComparator,
      updateTriggers: { getBackgroundColor: [selectedId, routeFocus], getPixelOffset: iconSize },
    }),
  );
}

export function buildLayers(s, onStopClick) {
  const layers = [];
  const sz = dynSizes(s.zoom);
  const F = { fontFamily: 'Arial,sans-serif', fontWeight: 'bold', billboard: true, background: false, getTextAnchor: 'middle', getAlignmentBaseline: 'bottom' };

  const stopFocus = s.stopFocus;
  const routeFocus = !!s.route?.id;
  const focusedRouteIds = getFocusedRouteIds(s);

  // ── Линии маршрутов (под остановками) ───────────────
  if (stopFocus?.routeIds?.length) {
    const entries = buildRoutePathEntries(stopFocus.routeIds, s);
    appendPathLayers(layers, entries, sz, 'stop-route');
  } else if (routeFocus && s.shapePath?.length) {
    const [r, g, b] = s.route.color ?? [30, 120, 210];
    appendPathLayers(layers, [{ path: s.shapePath, color: [r, g, b] }], sz, 'route');
  }

  // ── Остановки ───────────────────────────────────────
  let stopsData = s.allStops;
  let stopsMinZoom = 13;

  if (stopFocus?.routeIds?.length) {
    stopsData = collectStopsForRoutes(s.allStops, stopFocus.routeIds, s.stopIdsByRouteId);
    stopsMinZoom = 11;
  } else if (routeFocus && s.stopIdsByRouteId) {
    const onRoute = s.stopIdsByRouteId.get(s.route.id);
    if (onRoute?.length) {
      const ids = new Set(onRoute);
      stopsData = s.allStops.filter((st) => ids.has(st.stop_id));
      stopsMinZoom = 11;
    }
  }

  if (s.zoom >= stopsMinZoom && stopsData?.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'stops',
        data: stopsData,
        pickable: true,
        getPosition: (d) => [parseFloat(d.stop_lon), parseFloat(d.stop_lat)],
        getRadius: 1,
        radiusMinPixels: sz.stopR,
        getFillColor: (d) => d.stop_id === s.activeStopId ? [252, 63, 29, 255] : [255, 255, 255, 240],
        getLineColor: (d) => d.stop_id === s.activeStopId ? [180, 30, 10, 255] : [80, 80, 80, 200],
        lineWidthMinPixels: 2,
        stroked: true,
        filled: true,
        dataComparator: lenComparator,
        updateTriggers: { getFillColor: s.activeStopId, getLineColor: s.activeStopId },
        onClick: onStopClick,
      }),
    );
  }

  // ── Геолокация ──────────────────────────────────────
  if (s.userLocation) {
    layers.push(
      new ScatterplotLayer({ id: 'user-halo', data: [s.userLocation], getPosition: (d) => [d.lon, d.lat], getRadius: 1, radiusMinPixels: 18, getFillColor: [37, 99, 235, 35], filled: true }),
      new ScatterplotLayer({ id: 'user-dot', data: [s.userLocation], getPosition: (d) => [d.lon, d.lat], getRadius: 1, radiusMinPixels: 8, getFillColor: [37, 99, 235, 255], getLineColor: [255, 255, 255, 255], lineWidthMinPixels: 3, stroked: true, filled: true }),
    );
  }

  // ── Планировщик ─────────────────────────────────────
  if (s.plannerResult?.legs?.length) {
    const walkData = s.plannerResult.legs
      .filter((leg) => leg.type === 'walk' && leg.path?.length > 1)
      .map((leg, index) => ({ id: `walk-${index}`, path: leg.path }));
    const transitData = s.plannerResult.legs
      .filter((leg) => leg.type === 'transit' && leg.path?.length > 1)
      .map((leg, index) => ({ id: `transit-${index}`, path: leg.path, color: hexRgb(leg.color || '#e84525') }));

    if (walkData.length) {
      layers.push(
        new PathLayer({
          id: 'planner-walk',
          data: walkData,
          pickable: false,
          getPath: (d) => d.path,
          getColor: [37, 99, 235, 150],
          getWidth: 3,
          widthMinPixels: 3,
          rounded: true,
          capRounded: true,
        }),
      );
    }
    if (transitData.length) {
      layers.push(
        new PathLayer({
          id: 'planner-transit-shadow',
          data: transitData,
          pickable: false,
          getPath: (d) => d.path,
          getColor: (d) => [...d.color.slice(0, 3), 70],
          getWidth: 8,
          widthMinPixels: 7,
          rounded: true,
          capRounded: true,
        }),
        new PathLayer({
          id: 'planner-transit',
          data: transitData,
          pickable: false,
          getPath: (d) => d.path,
          getColor: (d) => [...d.color.slice(0, 3), 245],
          getWidth: 4,
          widthMinPixels: 4,
          rounded: true,
          capRounded: true,
        }),
      );
    }
  }

  const plannerMarkers = [];
  if (s.plannerFrom) plannerMarkers.push({ lon: s.plannerFrom.lon, lat: s.plannerFrom.lat, label: 'A', color: [14, 165, 233] });
  if (s.plannerTo) plannerMarkers.push({ lon: s.plannerTo.lon, lat: s.plannerTo.lat, label: 'B', color: [239, 68, 68] });
  if (plannerMarkers.length) {
    layers.push(
      new ScatterplotLayer({
        id: 'planner-marker-halo',
        data: plannerMarkers,
        pickable: false,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 1,
        radiusMinPixels: 16,
        getFillColor: (d) => [...d.color, 48],
        filled: true,
      }),
      new ScatterplotLayer({
        id: 'planner-marker-dot',
        data: plannerMarkers,
        pickable: false,
        getPosition: (d) => [d.lon, d.lat],
        getRadius: 1,
        radiusMinPixels: 10,
        getFillColor: (d) => [...d.color, 255],
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 3,
        stroked: true,
        filled: true,
      }),
      new TextLayer({
        id: 'planner-marker-text',
        data: plannerMarkers,
        pickable: false,
        getPosition: (d) => [d.lon, d.lat],
        getText: (d) => d.label,
        getSize: 18,
        sizeMinPixels: 14,
        sizeMaxPixels: 22,
        getColor: [255, 255, 255, 255],
        getPixelOffset: [0, 1],
        fontFamily: 'Arial,sans-serif',
        fontWeight: 'bold',
        billboard: true,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
      }),
    );
  }

  // ── Транспорт ───────────────────────────────────────
  const visibleVehicles = getVisibleVehicles(s);
  const vehiclesMinZoom = focusedRouteIds.length ? 10 : 11;
  if (s.zoom >= vehiclesMinZoom && visibleVehicles.length) {
    const prefix = routeFocus ? 'route' : (stopFocus?.routeIds?.length ? 'stop' : 'map');
    appendVehicleLayers(layers, visibleVehicles, s, sz, F, prefix, {
      routeFocus,
      accentRgb: routeFocus ? s.route?.color : null,
    });
  }

  return layers;
}