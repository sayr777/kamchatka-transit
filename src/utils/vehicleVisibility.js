/** Resolve GTFS route_id from a realtime vehicle payload. */
export function resolveVehicleRouteId(vehicle, tripToRoute) {
  if (!vehicle) return null;
  const direct = vehicle.routeId || vehicle.route_id;
  if (direct) return direct;
  const tripId = vehicle.tripId || vehicle.trip_id;
  if (tripId && tripToRoute) {
    const mapped = tripToRoute.get?.(tripId) ?? tripToRoute[tripId];
    if (mapped) return mapped;
  }
  return null;
}

/** Route ids that should filter vehicles on the map. */
export function getFocusedRouteIds(state) {
  if (state.route?.id) return [state.route.id];
  if (state.stopFocus?.routeIds?.length) return state.stopFocus.routeIds;
  return [];
}

/** Vehicles visible for the current map focus (all when nothing selected). */
export function getVisibleVehicles(state) {
  const vehicles = state.vehicles || [];
  const routeIds = getFocusedRouteIds(state);
  if (!routeIds.length) return vehicles;

  const allowed = new Set(routeIds);
  return vehicles
    .map((v) => {
      const routeId = resolveVehicleRouteId(v, state.tripToRoute);
      return routeId ? { ...v, routeId } : null;
    })
    .filter((v) => v && allowed.has(v.routeId));
}

import { resolveVehicleIconType } from '../components/Map/vehicleIcons.js';

/** Normalize vehicles once when ingesting realtime data. */
export function normalizeVehicles(rawVehicles, tripToRoute, routeMetaById, vehicleTypeById) {
  return (rawVehicles || []).map((v) => {
    const routeId = resolveVehicleRouteId(v, tripToRoute);
    const meta = routeId ? routeMetaById?.get?.(routeId) : null;
    const vehicleType = vehicleTypeById?.get?.(v.id)
      ?? vehicleTypeById?.get?.(v.vehicle_id);
    return {
      ...v,
      routeId,
      label: v.label || meta?.shortName || meta?.name || '',
      routeType: resolveVehicleIconType(meta, { ...v, vehicleType }),
    };
  }).filter((v) => v.lon && v.lat);
}