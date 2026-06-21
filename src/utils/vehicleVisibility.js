import { resolveVehicleIconType } from '../components/Map/vehicleIcons.js';
import { bearingOnPath, shapePointsToPath } from './routePath.js';

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

/** Geographic bearing aligned to the route polyline when shape data is available. */
export function resolveVehicleBearing(vehicle, ctx = {}) {
  const raw = Number(vehicle?.bearing);
  const hint = Number.isFinite(raw) ? raw : null;
  const routeId = vehicle?.routeId;
  if (!routeId) return hint ?? 0;

  const shapeId = ctx.firstShapeByRoute?.get?.(routeId);
  if (!shapeId) return hint ?? 0;

  const path = shapePointsToPath(ctx.shapesByShapeId?.get?.(shapeId));
  if (path.length < 2) return hint ?? 0;

  return bearingOnPath(path, vehicle.lon, vehicle.lat, hint);
}

/** Normalize vehicles once when ingesting realtime data. */
export function normalizeVehicles(rawVehicles, tripToRoute, routeMetaById, vehicleTypeById, shapeCtx) {
  return (rawVehicles || []).map((v) => {
    const routeId = resolveVehicleRouteId(v, tripToRoute);
    const meta = routeId ? routeMetaById?.get?.(routeId) : null;
    const vehicleType = vehicleTypeById?.get?.(v.id)
      ?? vehicleTypeById?.get?.(v.vehicle_id);
    const normalized = {
      ...v,
      routeId,
      label: v.label || meta?.shortName || meta?.name || '',
      routeType: resolveVehicleIconType(meta, { ...v, vehicleType }),
    };
    return {
      ...normalized,
      bearing: resolveVehicleBearing(normalized, shapeCtx),
    };
  }).filter((v) => v.lon && v.lat);
}