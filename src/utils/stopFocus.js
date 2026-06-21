/** Маршруты, проходящие через остановку. */
export function getRouteIdsForStop(stopId, routeIdsByStopId, arrivalsByStopId) {
  if (!stopId) return [];
  const fromIndex = routeIdsByStopId?.get?.(stopId);
  if (fromIndex?.length) return [...fromIndex];

  const arrivals = arrivalsByStopId?.get?.(stopId) || [];
  const ids = new Set();
  for (const a of arrivals) {
    if (a.routeId) ids.add(a.routeId);
  }
  return [...ids];
}

export function shortStopName(name, maxLen = 24) {
  const text = (name || '').trim();
  if (!text) return '—';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1)}…`;
}

export function buildRoutePathEntries(routeIds, { firstShapeByRoute, shapesByShapeId, routeMetaById }) {
  const entries = [];
  for (const routeId of routeIds) {
    const shapeId = firstShapeByRoute?.get?.(routeId);
    if (!shapeId) continue;
    const coords = shapesByShapeId?.get?.(shapeId) || [];
    const path = coords
      .map((p) => [
        parseFloat(p.shape_pt_lon ?? p.lon ?? p[0]),
        parseFloat(p.shape_pt_lat ?? p.lat ?? p[1]),
      ])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
    if (!path.length) continue;
    const meta = routeMetaById?.get?.(routeId);
    const hex = (meta?.hex || '#1e78d0').replace('#', '');
    const color = [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
    entries.push({ path, color, routeId, meta });
  }
  return entries;
}

/** Остановки на пересечении маршрутов через выбранную точку. */
export function collectStopsForRoutes(allStops, routeIds, stopIdsByRouteId) {
  if (!routeIds?.length || !allStops?.length) return allStops;
  const ids = new Set();
  for (const routeId of routeIds) {
    for (const stopId of stopIdsByRouteId?.get?.(routeId) || []) {
      ids.add(stopId);
    }
  }
  if (!ids.size) return allStops;
  return allStops.filter((st) => ids.has(st.stop_id));
}