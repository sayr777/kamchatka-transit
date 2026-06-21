import { haversineMeters, normalizeName, parseTimeMin } from './geo.js';

export const PLANNER_WALK_RADIUS_METERS = 700;
export const PLANNER_TRANSFER_RADIUS_METERS = 220;
export const PLANNER_WALK_SPEED_MPS = 1.35;
export const PLANNER_TRANSFER_WAIT_MIN = 4;
export const PLANNER_INITIAL_WAIT_MIN = 2;

function walkMinutesForMeters(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  if (distanceMeters <= 35) return 0;
  return Math.max(1, Math.round((distanceMeters / PLANNER_WALK_SPEED_MPS) / 60));
}

function addEdge(adjacency, fromStopId, edge) {
  if (!adjacency.has(fromStopId)) adjacency.set(fromStopId, []);
  adjacency.get(fromStopId).push(edge);
}

function resolveRouteHex(route, routeId) {
  const c = route?.route_color || route?.hex?.replace?.('#', '');
  if (c) return `#${String(c).replace('#', '')}`;
  return '#1e78d0';
}

/** Spatial grid for O(n) walk-link candidates instead of O(n²). */
function linkWalkTransfers(stopList, stopById, adjacency) {
  const CELL = 0.0022;
  const grid = new Map();
  for (const id of stopList) {
    const s = stopById.get(id);
    if (!s) continue;
    const key = `${Math.floor(s.lon / CELL)}:${Math.floor(s.lat / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(id);
  }

  const seen = new Set();
  for (const id of stopList) {
    const a = stopById.get(id);
    if (!a) continue;
    const cx = Math.floor(a.lon / CELL);
    const cy = Math.floor(a.lat / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const otherId of bucket) {
          if (otherId <= id) continue;
          const pairKey = `${id}|${otherId}`;
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);
          const b = stopById.get(otherId);
          if (!b) continue;
          const distanceMeters = haversineMeters(a.lat, a.lon, b.lat, b.lon);
          const sameName = normalizeName(a.name) === normalizeName(b.name);
          if (distanceMeters > PLANNER_TRANSFER_RADIUS_METERS
            && !(sameName && distanceMeters <= PLANNER_TRANSFER_RADIUS_METERS * 1.8)) continue;
          const durationMin = walkMinutesForMeters(distanceMeters);
          addEdge(adjacency, id, {
            type: 'walk',
            fromStopId: id,
            toStopId: otherId,
            fromName: a.name,
            toName: b.name,
            durationMin,
            distanceMeters,
            path: [[a.lon, a.lat], [b.lon, b.lat]],
          });
          addEdge(adjacency, otherId, {
            type: 'walk',
            fromStopId: otherId,
            toStopId: id,
            fromName: b.name,
            toName: a.name,
            durationMin,
            distanceMeters,
            path: [[b.lon, b.lat], [a.lon, a.lat]],
          });
        }
      }
    }
  }
}

export function buildPlannerAdjacency(stopById, stopTimesByTrip, tripMetaById, routeMetaById) {
  const adjacency = new Map();
  const transitBest = new Map();
  const getMeta = (id) => routeMetaById?.get?.(id) ?? routeMetaById?.[id];
  const getTrip = (id) => tripMetaById?.get?.(id) ?? tripMetaById?.[id];

  for (const [tripId, rows] of Object.entries(stopTimesByTrip || {})) {
    const ordered = rows.slice().sort((a, b) => (+a.stop_sequence) - (+b.stop_sequence));
    const trip = getTrip(tripId);
    const routeId = trip?.route_id;
    const route = getMeta(routeId);
    if (!routeId || ordered.length < 2) continue;

    for (let i = 0; i < ordered.length - 1; i++) {
      const fromRow = ordered[i];
      const toRow = ordered[i + 1];
      const fromStop = stopById.get?.(fromRow.stop_id) ?? stopById[fromRow.stop_id];
      const toStop = stopById.get?.(toRow.stop_id) ?? stopById[toRow.stop_id];
      if (!fromStop || !toStop) continue;

      const departMin = parseTimeMin(fromRow.departure_time || fromRow.arrival_time);
      const arriveMin = parseTimeMin(toRow.arrival_time || toRow.departure_time);
      const durationMin = Math.max(1, Number.isFinite(arriveMin - departMin) ? (arriveMin - departMin) : 2);
      const edgeKey = [fromRow.stop_id, toRow.stop_id, routeId, trip?.direction_id || '', trip?.trip_headsign || ''].join('|');
      const candidate = {
        type: 'transit',
        fromStopId: fromRow.stop_id,
        toStopId: toRow.stop_id,
        fromName: fromStop.name,
        toName: toStop.name,
        routeId,
        routeShort: route?.route_short_name || route?.shortName || routeId,
        headsign: trip?.trip_headsign || '',
        color: resolveRouteHex(route, routeId),
        durationMin,
        distanceMeters: haversineMeters(fromStop.lat, fromStop.lon, toStop.lat, toStop.lon),
        path: [[fromStop.lon, fromStop.lat], [toStop.lon, toStop.lat]],
      };
      const existing = transitBest.get(edgeKey);
      if (!existing || candidate.durationMin < existing.durationMin) transitBest.set(edgeKey, candidate);
    }
  }

  for (const edge of transitBest.values()) addEdge(adjacency, edge.fromStopId, edge);

  const stopIds = stopById instanceof Map ? [...stopById.keys()] : Object.keys(stopById);
  linkWalkTransfers(stopIds, stopById instanceof Map ? stopById : new Map(Object.entries(stopById)), adjacency);

  return adjacency;
}

export function adjacencyToObject(adjacency) {
  const out = {};
  for (const [k, v] of adjacency) out[k] = v;
  return out;
}

export function adjacencyFromObject(obj) {
  return new Map(Object.entries(obj || {}));
}

function plannerStateKey(nodeId, currentRouteId, lastTransitRouteId, lastEdgeType) {
  return [nodeId, currentRouteId || '', lastTransitRouteId || '', lastEdgeType || ''].join('|');
}

function plannerStateScore(state) {
  return (state.totalMin || 0) + (state.transfers || 0) * 10;
}

function isPlannerCostBetter(candidate, existing) {
  if (!existing) return true;
  const cs = plannerStateScore(candidate);
  const es = plannerStateScore(existing);
  if (cs !== es) return cs < es;
  if ((candidate.transfers || 0) !== (existing.transfers || 0)) return (candidate.transfers || 0) < (existing.transfers || 0);
  if ((candidate.totalMin || 0) !== (existing.totalMin || 0)) return (candidate.totalMin || 0) < (existing.totalMin || 0);
  return (candidate.walkMin || 0) < (existing.walkMin || 0);
}

function takeBestPlannerState(queue) {
  let bestIndex = 0;
  for (let i = 1; i < queue.length; i++) {
    if (isPlannerCostBetter(queue[i], queue[bestIndex])) bestIndex = i;
  }
  return queue.splice(bestIndex, 1)[0];
}

export function getPlannerAccessStops(point, allStops, maxRadiusMeters = PLANNER_WALK_RADIUS_METERS) {
  if (!point || !allStops?.length) return [];
  const candidates = allStops.map((stop) => {
    const lat = parseFloat(stop.stop_lat);
    const lon = parseFloat(stop.stop_lon);
    const distanceMeters = haversineMeters(point.lat, point.lon, lat, lon);
    return {
      stopId: stop.stop_id,
      stop: { stop_id: stop.stop_id, name: stop.stop_name || stop.stop_id, lat, lon },
      distanceMeters,
      durationMin: walkMinutesForMeters(distanceMeters),
    };
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);

  const nearby = candidates.filter((item) => item.distanceMeters <= maxRadiusMeters).slice(0, 8);
  if (nearby.length) return nearby;
  return candidates.slice(0, 6).filter((item) => item.distanceMeters <= maxRadiusMeters * 2.2);
}

function appendPlannerPath(target, points) {
  if (!points?.length) return;
  if (!target.path.length) {
    target.path = points.slice();
    return;
  }
  const last = target.path[target.path.length - 1];
  const next = points[0];
  const same = last && next && last[0] === next[0] && last[1] === next[1];
  target.path.push(...(same ? points.slice(1) : points));
}

function buildPlannerResult(finalState, states) {
  const edges = [];
  let cursor = finalState;
  while (cursor?.viaEdge) {
    edges.push(cursor.viaEdge);
    cursor = cursor.prevKey ? states.get(cursor.prevKey) : null;
  }
  edges.reverse();

  const legs = [];
  for (const edge of edges) {
    if (!edge) continue;
    const last = legs[legs.length - 1];
    if (edge.type === 'walk') {
      if (last?.type === 'walk') {
        last.durationMin += edge.durationMin || 0;
        last.distanceMeters += edge.distanceMeters || 0;
        last.toName = edge.toName || last.toName;
        last.toStopId = edge.toStopId || last.toStopId;
        appendPlannerPath(last, edge.path || []);
      } else {
        legs.push({
          type: 'walk',
          durationMin: edge.durationMin || 0,
          distanceMeters: edge.distanceMeters || 0,
          fromName: edge.fromName || '',
          toName: edge.toName || '',
          fromStopId: edge.fromStopId || '',
          toStopId: edge.toStopId || '',
          path: (edge.path || []).slice(),
        });
      }
      continue;
    }
    if (last?.type === 'transit' && last.routeId === edge.routeId) {
      last.durationMin += edge.durationMin || 0;
      last.waitMin += edge.waitMin || 0;
      last.distanceMeters += edge.distanceMeters || 0;
      last.toName = edge.toName || last.toName;
      last.toStopId = edge.toStopId || last.toStopId;
      last.stopCount += 1;
      appendPlannerPath(last, edge.path || []);
    } else {
      legs.push({
        type: 'transit',
        routeId: edge.routeId,
        routeShort: edge.routeShort || edge.routeId,
        color: edge.color || '#e84525',
        headsign: edge.headsign || '',
        durationMin: edge.durationMin || 0,
        waitMin: edge.waitMin || 0,
        distanceMeters: edge.distanceMeters || 0,
        fromName: edge.fromName || '',
        toName: edge.toName || '',
        fromStopId: edge.fromStopId || '',
        toStopId: edge.toStopId || '',
        stopCount: 1,
        path: (edge.path || []).slice(),
      });
    }
  }

  return {
    totalTimeMin: finalState.totalMin || 0,
    totalWalkMin: legs.filter((leg) => leg.type === 'walk').reduce((sum, leg) => sum + (leg.durationMin || 0), 0),
    transfers: finalState.transfers || 0,
    legs,
  };
}

export function makePlannerPoint(lon, lat, allStops, meta = {}, pointOnMapLabel = 'Point on map') {
  const point = {
    lon,
    lat,
    source: meta.source || 'map',
    stopId: meta.stopId || '',
    stopName: meta.stopName || '',
    label: meta.label || pointOnMapLabel,
    nearStopId: meta.stopId || '',
    nearStopName: meta.stopName || '',
    nearDistanceMeters: 0,
  };
  if (!point.stopId) {
    const nearest = getPlannerAccessStops(
      { lon, lat },
      allStops,
      Math.min(PLANNER_TRANSFER_RADIUS_METERS, 260),
    )[0];
    if (nearest) {
      point.nearStopId = nearest.stopId;
      point.nearStopName = nearest.stop.name;
      point.nearDistanceMeters = nearest.distanceMeters;
    }
  }
  return point;
}

export function plannerPointTitle(point, pointOnMapLabel = 'Point on map') {
  if (!point) return '—';
  return point.stopName || pointOnMapLabel;
}

export function formatPlannerDuration(value, lang = 'ru') {
  const rounded = Math.max(0, Math.round(value || 0));
  if (lang === 'en') return `${rounded} min`;
  if (lang === 'zh' || lang === 'ja') return `${rounded} 分`;
  return `${rounded} мин`;
}

export function formatPlannerDistance(distanceMeters, lang = 'ru') {
  const rounded = Math.max(0, Math.round(distanceMeters || 0));
  if (rounded >= 1000) {
    const km = (rounded / 1000).toFixed(1);
    return lang === 'en' ? `${km} km` : `${km} км`;
  }
  return lang === 'en' ? `${rounded} m` : `${rounded} м`;
}

export function computePlannerRoute(from, to, adjacency, allStops, pointOnMapLabel = 'Point on map') {
  if (!from || !to) return { error: 'ready' };
  if (!adjacency?.size) return { error: 'noRoute' };

  const startCandidates = getPlannerAccessStops(from, allStops);
  const endCandidates = getPlannerAccessStops(to, allStops);
  if (!startCandidates.length || !endCandidates.length) return { error: 'noRoute' };

  const endByStopId = new Map();
  for (const candidate of endCandidates) {
    const prev = endByStopId.get(candidate.stopId);
    if (!prev || candidate.durationMin < prev.durationMin) endByStopId.set(candidate.stopId, candidate);
  }

  const queue = [];
  const bestByKey = new Map();
  const states = new Map();

  for (const candidate of startCandidates) {
    const key = plannerStateKey(candidate.stopId, null, null, 'walk');
    const state = {
      key,
      nodeId: candidate.stopId,
      totalMin: candidate.durationMin,
      walkMin: candidate.durationMin,
      transfers: 0,
      currentRouteId: null,
      lastTransitRouteId: null,
      lastEdgeType: 'walk',
      usedTransit: false,
      prevKey: null,
      viaEdge: {
        type: 'walk',
        fromName: plannerPointTitle(from, pointOnMapLabel),
        toName: candidate.stop.name,
        fromStopId: '__from__',
        toStopId: candidate.stopId,
        durationMin: candidate.durationMin,
        distanceMeters: candidate.distanceMeters,
        path: [[from.lon, from.lat], [candidate.stop.lon, candidate.stop.lat]],
      },
    };
    const prev = bestByKey.get(key);
    if (isPlannerCostBetter(state, prev)) {
      bestByKey.set(key, state);
      states.set(key, state);
      queue.push(state);
    }
  }

  let bestFinal = null;
  let iterations = 0;
  const MAX_ITER = 12000;

  while (queue.length && iterations < MAX_ITER) {
    iterations++;
    const state = takeBestPlannerState(queue);
    if (bestByKey.get(state.key) !== state) continue;

    const finish = endByStopId.get(state.nodeId);
    if (finish && state.usedTransit) {
      const finalKey = `${state.key}|finish`;
      const finishState = {
        key: finalKey,
        nodeId: '__to__',
        totalMin: state.totalMin + finish.durationMin,
        walkMin: state.walkMin + finish.durationMin,
        transfers: state.transfers,
        currentRouteId: null,
        lastTransitRouteId: state.lastTransitRouteId,
        lastEdgeType: 'walk',
        usedTransit: true,
        prevKey: state.key,
        viaEdge: {
          type: 'walk',
          fromName: finish.stop.name,
          toName: plannerPointTitle(to, pointOnMapLabel),
          fromStopId: finish.stopId,
          toStopId: '__to__',
          durationMin: finish.durationMin,
          distanceMeters: finish.distanceMeters,
          path: [[finish.stop.lon, finish.stop.lat], [to.lon, to.lat]],
        },
      };
      if (isPlannerCostBetter(finishState, bestFinal)) {
        bestFinal = finishState;
        states.set(finalKey, finishState);
      }
    }

    const edges = adjacency.get(state.nodeId) || [];
    for (const edge of edges) {
      let nextState;
      if (edge.type === 'walk') {
        nextState = {
          key: plannerStateKey(edge.toStopId, null, state.lastTransitRouteId, 'walk'),
          nodeId: edge.toStopId,
          totalMin: state.totalMin + (edge.durationMin || 0),
          walkMin: state.walkMin + (edge.durationMin || 0),
          transfers: state.transfers,
          currentRouteId: null,
          lastTransitRouteId: state.lastTransitRouteId,
          lastEdgeType: 'walk',
          usedTransit: state.usedTransit,
          prevKey: state.key,
          viaEdge: { ...edge },
        };
      } else {
        const sameTransit = state.lastEdgeType === 'transit' && state.currentRouteId === edge.routeId;
        const transferInc = !sameTransit && state.lastTransitRouteId && state.lastTransitRouteId !== edge.routeId ? 1 : 0;
        const waitMin = sameTransit ? 0 : (state.lastTransitRouteId ? PLANNER_TRANSFER_WAIT_MIN : PLANNER_INITIAL_WAIT_MIN);
        nextState = {
          key: plannerStateKey(edge.toStopId, edge.routeId, edge.routeId, 'transit'),
          nodeId: edge.toStopId,
          totalMin: state.totalMin + (edge.durationMin || 0) + waitMin,
          walkMin: state.walkMin,
          transfers: state.transfers + transferInc,
          currentRouteId: edge.routeId,
          lastTransitRouteId: edge.routeId,
          lastEdgeType: 'transit',
          usedTransit: true,
          prevKey: state.key,
          viaEdge: { ...edge, durationMin: (edge.durationMin || 0) + waitMin, waitMin },
        };
      }
      const existing = bestByKey.get(nextState.key);
      if (isPlannerCostBetter(nextState, existing)) {
        bestByKey.set(nextState.key, nextState);
        states.set(nextState.key, nextState);
        queue.push(nextState);
      }
    }
  }

  if (!bestFinal) return { error: 'noRoute' };
  return { result: buildPlannerResult(bestFinal, states) };
}

export function plannerBoundsFromResult(result) {
  const coords = (result?.legs || []).flatMap((leg) => leg.path || []);
  if (!coords.length) return null;
  const lons = coords.map((p) => p[0]);
  const lats = coords.map((p) => p[1]);
  const span = Math.max(
    (Math.max(...lons) - Math.min(...lons)) * 1.25,
    (Math.max(...lats) - Math.min(...lats)) * 1.25,
    0.01,
  );
  const zoom = span > 0.25 ? 11.4 : span > 0.12 ? 12.2 : span > 0.05 ? 13.2 : 14.2;
  return {
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    zoom,
  };
}