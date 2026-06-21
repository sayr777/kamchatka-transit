/** Текст для поиска по маршруту: номер + название + id. */
export function routeSearchText(route, meta) {
  return [
    route?.route_short_name,
    route?.route_long_name,
    route?.route_id,
    meta?.shortName,
    meta?.name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function normalizeSearchQuery(query) {
  return (query ?? '').trim().toLowerCase();
}

function matchShortName(short, q) {
  if (!short || !q) return false;
  if (short === q) return true;
  if (!short.startsWith(q)) return false;
  const rest = short.slice(q.length);
  // «2» → «2», «6» → «6к», но не «2» → «12» / «21»
  return !rest || !/^\d/.test(rest);
}

/** Совпадение по номеру (точное / префикс) или по полному тексту. */
export function matchRoute(route, query, meta) {
  const q = normalizeSearchQuery(query);
  if (!q) return false;

  const short = (route?.route_short_name || meta?.shortName || '').toLowerCase();
  const hay = routeSearchText(route, meta);

  if (matchShortName(short, q)) return true;

  // Одна цифра — только номер маршрута
  if (/^\d$/u.test(q)) return false;

  return hay.includes(q);
}

/** Один результат на номер маршрута (без дублей туда/обратно). */
export function dedupeRoutesByShortName(routes) {
  const seen = new Map();
  for (const route of routes) {
    const key = (route?.route_short_name || route?.route_id || '').toLowerCase();
    if (!seen.has(key)) seen.set(key, route);
  }
  return [...seen.values()];
}

/** Короткий запрос похож на номер маршрута — показываем маршруты первыми. */
export function looksLikeRouteQuery(query) {
  const q = normalizeSearchQuery(query);
  return q.length > 0 && /^[\d\wа-яё]{1,8}$/iu.test(q);
}

export function searchRoutes(routes, query, routeMetaById, limit = 6) {
  const q = normalizeSearchQuery(query);
  if (!q) return [];

  return dedupeRoutesByShortName(
    routes.filter((r) => matchRoute(r, q, routeMetaById?.get?.(r.route_id)))
  )
    .sort((a, b) => {
      const sa = (a.route_short_name || '').toLowerCase();
      const sb = (b.route_short_name || '').toLowerCase();
      const na = parseInt(sa, 10);
      const nb = parseInt(sb, 10);
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return sa.localeCompare(sb, 'ru', { numeric: true });
    })
    .slice(0, limit);
}

export function searchStops(stops, query, limit = 6) {
  const q = normalizeSearchQuery(query);
  if (!q) return [];
  return stops
    .filter((s) => (s.stop_name || '').toLowerCase().includes(q))
    .slice(0, limit);
}