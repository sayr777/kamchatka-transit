const STOPS_KEY = 'kamchatka.transport.favoriteStops';
const ROUTES_KEY = 'kamchatka.transport.favoriteRoutes';

function loadIds(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

function saveIds(key, ids) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function loadFavoriteStopIds() {
  return loadIds(STOPS_KEY);
}

export function loadFavoriteRouteIds() {
  return loadIds(ROUTES_KEY);
}

export function saveFavoriteStopIds(ids) {
  saveIds(STOPS_KEY, ids);
}

export function saveFavoriteRouteIds(ids) {
  saveIds(ROUTES_KEY, ids);
}

export function toggleFavoriteId(ids, id) {
  if (!id) return { ids, added: false };
  if (ids.includes(id)) {
    return { ids: ids.filter((x) => x !== id), added: false };
  }
  return { ids: [id, ...ids], added: true };
}

export function resolveFavoriteStops(stopIds, allStops) {
  if (!stopIds.length || !allStops?.length) return [];
  const byId = new Map(allStops.map((s) => [s.stop_id, s]));
  return stopIds.map((id) => byId.get(id)).filter(Boolean);
}

export function resolveFavoriteRoutes(routeIds, allRoutes) {
  if (!routeIds.length || !allRoutes?.length) return [];
  const byId = new Map(allRoutes.map((r) => [r.route_id, r]));
  return routeIds.map((id) => byId.get(id)).filter(Boolean);
}