/** GTFS tri-state: 0/empty → unknown, 1 → yes, 2 → no */
export function parseGtfsTriState(value) {
  const v = String(value ?? '').trim();
  if (v === '1') return 'yes';
  if (v === '2') return 'no';
  return 'unknown';
}

export function mergeTriState(current, value) {
  const next = parseGtfsTriState(value);
  if (next === 'unknown') return current || 'unknown';
  if (!current || current === 'unknown') return next;
  if (current === next) return current;
  return 'partial';
}

export function mergeBoolFlag(current, isYes) {
  if (isYes == null) return current;
  if (current == null) return isYes ? 'yes' : 'no';
  if (current === 'yes' && !isYes) return 'partial';
  if (current === 'no' && isYes) return 'partial';
  return isYes ? 'yes' : 'no';
}

/** Aggregate route conditions from trips + vehicles (worker output shape). */
export function buildRouteConditionsIndex(trips, vehicles, vehicleTrips) {
  const byRoute = {};

  for (const trip of trips || []) {
    if (!trip.route_id) continue;
    if (!byRoute[trip.route_id]) {
      byRoute[trip.route_id] = { wheelchair: 'unknown', bikes: 'unknown', lowFloor: 'unknown' };
    }
    const c = byRoute[trip.route_id];
    c.wheelchair = mergeTriState(c.wheelchair, trip.wheelchair_accessible);
    c.bikes = mergeTriState(c.bikes, trip.bikes_allowed);
  }

  const vehiclesById = new Map((vehicles || []).map((v) => [v.vehicle_id, v]));
  const routeVehicles = new Map();

  for (const vt of vehicleTrips || []) {
    if (!vt.route_id || !vt.vehicle_id) continue;
    if (!routeVehicles.has(vt.route_id)) routeVehicles.set(vt.route_id, new Set());
    routeVehicles.get(vt.route_id).add(vt.vehicle_id);
  }

  for (const [routeId, vehIds] of routeVehicles) {
    if (!byRoute[routeId]) {
      byRoute[routeId] = { wheelchair: 'unknown', bikes: 'unknown', lowFloor: 'unknown' };
    }
    const c = byRoute[routeId];
    let wheelchairYes = false;
    let wheelchairNo = false;
    let lowFloorYes = false;

    for (const vid of vehIds) {
      const v = vehiclesById.get(vid);
      if (!v) continue;
      if (String(v.wheelchair) === '1') wheelchairYes = true;
      if (String(v.wheelchair) === '0') wheelchairNo = true;
      if (String(v.low_floor) === '1') lowFloorYes = true;
    }

    if (wheelchairYes && c.wheelchair === 'unknown') {
      c.wheelchair = 'yes';
    } else if (wheelchairYes && c.wheelchair === 'no') {
      c.wheelchair = 'partial';
    } else if (wheelchairNo && c.wheelchair === 'unknown') {
      c.wheelchair = 'no';
    }
    if (lowFloorYes) c.lowFloor = 'yes';
  }

  return byRoute;
}

export function getStopConditionTags(stop, t) {
  const tags = [];
  const wb = parseGtfsTriState(stop?.wheelchair_boarding);
  if (wb === 'yes') {
    tags.push({ key: 'stop-wheelchair', icon: '♿', label: t('conditions.stop.wheelchair') });
  }
  return tags;
}

export const CONDITION_FILTER_KEYS = ['wheelchair', 'lowFloor', 'bikes'];

export function routeMatchesCondition(routeId, routeConditionsById, filter) {
  const c = routeConditionsById?.get?.(routeId) ?? routeConditionsById?.[routeId];
  if (!c) return false;
  if (filter === 'wheelchair') return c.wheelchair === 'yes' || c.wheelchair === 'partial';
  if (filter === 'lowFloor') return c.lowFloor === 'yes';
  if (filter === 'bikes') return c.bikes === 'yes' || c.bikes === 'partial';
  return false;
}

export function stopMatchesCondition(stop, filter) {
  if (filter !== 'wheelchair') return false;
  return parseGtfsTriState(stop?.wheelchair_boarding) === 'yes';
}

export function filterRoutesByCondition(allRoutes, routeConditionsById, filter) {
  if (!filter || !allRoutes?.length) return [];
  return allRoutes.filter((r) => routeMatchesCondition(r.route_id, routeConditionsById, filter));
}

export function filterStopsByCondition(allStops, filter) {
  if (!filter || !allStops?.length) return [];
  return allStops.filter((s) => stopMatchesCondition(s, filter));
}

export function getConditionFilters(t) {
  return [
    { key: 'wheelchair', icon: '♿', label: t('panel.conditions.filter.wheelchair') },
    { key: 'lowFloor', icon: '⬇️', label: t('panel.conditions.filter.low_floor') },
    { key: 'bikes', icon: '🚲', label: t('panel.conditions.filter.bikes') },
  ];
}

export function getRouteConditionTags(routeId, routeConditionsById, t) {
  const c = routeConditionsById?.get?.(routeId) ?? routeConditionsById?.[routeId];
  if (!c) return [];

  const tags = [];
  if (c.wheelchair === 'yes') {
    tags.push({ key: 'route-wheelchair', icon: '♿', label: t('conditions.route.wheelchair') });
  } else if (c.wheelchair === 'partial') {
    tags.push({ key: 'route-wheelchair-partial', icon: '♿', label: t('conditions.route.wheelchair_partial') });
  }
  if (c.bikes === 'yes') {
    tags.push({ key: 'route-bikes', icon: '🚲', label: t('conditions.route.bikes') });
  } else if (c.bikes === 'partial') {
    tags.push({ key: 'route-bikes-partial', icon: '🚲', label: t('conditions.route.bikes_partial') });
  }
  if (c.lowFloor === 'yes') {
    tags.push({ key: 'route-lowfloor', icon: '⬇️', label: t('conditions.route.low_floor') });
  }
  return tags;
}