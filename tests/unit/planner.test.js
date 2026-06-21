import { describe, it, expect } from 'vitest';
import {
  buildPlannerAdjacency,
  computePlannerRoute,
  getPlannerAccessStops,
  makePlannerPoint,
  plannerBoundsFromResult,
} from '../../src/utils/planner.js';

const stopById = new Map([
  ['s1', { stop_id: 's1', name: 'Alpha', lat: 53.010, lon: 158.700 }],
  ['s2', { stop_id: 's2', name: 'Beta', lat: 53.015, lon: 158.705 }],
  ['s3', { stop_id: 's3', name: 'Gamma', lat: 53.020, lon: 158.710 }],
]);

const stopTimesByTrip = {
  t1: [
    { stop_id: 's1', stop_sequence: 1, departure_time: '08:00:00', arrival_time: '08:00:00' },
    { stop_id: 's2', stop_sequence: 2, departure_time: '08:10:00', arrival_time: '08:10:00' },
    { stop_id: 's3', stop_sequence: 3, departure_time: '08:20:00', arrival_time: '08:20:00' },
  ],
};

const tripMetaById = {
  t1: { route_id: 'r1', trip_headsign: 'Gamma', direction_id: '0' },
};

const routeMetaById = {
  r1: { route_short_name: '1', route_color: 'e84525' },
};

const allStops = [...stopById.values()].map((s) => ({
  stop_id: s.stop_id,
  stop_name: s.name,
  stop_lat: String(s.lat),
  stop_lon: String(s.lon),
}));

describe('planner', () => {
  it('builds transit adjacency from stop_times', () => {
    const adj = buildPlannerAdjacency(stopById, stopTimesByTrip, tripMetaById, routeMetaById);
    expect(adj.has('s1')).toBe(true);
    const edges = adj.get('s1');
    expect(edges.some((e) => e.type === 'transit' && e.toStopId === 's2')).toBe(true);
  });

  it('finds direct transit route between nearby stops', () => {
    const adj = buildPlannerAdjacency(stopById, stopTimesByTrip, tripMetaById, routeMetaById);
    const from = makePlannerPoint(158.700, 53.010, allStops, { stopId: 's1', stopName: 'Alpha', source: 'stop' });
    const to = makePlannerPoint(158.710, 53.020, allStops, { stopId: 's3', stopName: 'Gamma', source: 'stop' });
    const out = computePlannerRoute(from, to, adj, allStops, 'Point');
    expect(out.error).toBeUndefined();
    expect(out.result?.legs?.some((leg) => leg.type === 'transit')).toBe(true);
    expect(out.result.transfers).toBe(0);
  });

  it('returns noRoute when points are unreachable', () => {
    const adj = buildPlannerAdjacency(stopById, stopTimesByTrip, tripMetaById, routeMetaById);
    const from = { lon: 150, lat: 50 };
    const to = { lon: 151, lat: 51 };
    const out = computePlannerRoute(from, to, adj, allStops, 'Point');
    expect(out.error).toBe('noRoute');
  });

  it('lists access stops within walk radius', () => {
    const access = getPlannerAccessStops({ lon: 158.700, lat: 53.010 }, allStops);
    expect(access.length).toBeGreaterThan(0);
    expect(access[0].stopId).toBe('s1');
  });

  it('computes bounds from route legs', () => {
    const adj = buildPlannerAdjacency(stopById, stopTimesByTrip, tripMetaById, routeMetaById);
    const from = makePlannerPoint(158.700, 53.010, allStops);
    const to = makePlannerPoint(158.710, 53.020, allStops);
    const out = computePlannerRoute(from, to, adj, allStops, 'Point');
    const bounds = plannerBoundsFromResult(out.result);
    expect(bounds?.longitude).toBeCloseTo(158.705, 2);
    expect(bounds?.latitude).toBeCloseTo(53.015, 2);
    expect(bounds?.zoom).toBeGreaterThan(10);
  });
});