import { describe, it, expect } from 'vitest';
import {
  resolveVehicleRouteId,
  getFocusedRouteIds,
  getVisibleVehicles,
  normalizeVehicles,
  resolveVehicleBearing,
} from '../../src/utils/vehicleVisibility.js';
import { bearingOnPath, samplePath, shapePointsToPath } from '../../src/utils/routePath.js';

describe('vehicleVisibility', () => {
  const tripToRoute = new Map([['trip_1', 'route_a']]);
  const routeMetaById = new Map([['route_a', { shortName: '3' }]]);

  it('resolves route from trip_id', () => {
    expect(resolveVehicleRouteId({ tripId: 'trip_1' }, tripToRoute)).toBe('route_a');
    expect(resolveVehicleRouteId({ routeId: 'route_b' }, tripToRoute)).toBe('route_b');
  });

  it('filters vehicles for selected route', () => {
    const state = {
      route: { id: 'route_a' },
      stopFocus: null,
      tripToRoute,
      vehicles: [
        { id: 'v1', routeId: 'route_a', lon: 1, lat: 2 },
        { id: 'v2', routeId: 'route_b', lon: 1, lat: 2 },
      ],
    };
    expect(getFocusedRouteIds(state)).toEqual(['route_a']);
    expect(getVisibleVehicles(state).map((v) => v.id)).toEqual(['v1']);
  });

  it('filters vehicles for stop focus routes', () => {
    const state = {
      route: null,
      stopFocus: { routeIds: ['route_a', 'route_c'] },
      tripToRoute,
      vehicles: [
        { id: 'v1', routeId: 'route_a', lon: 1, lat: 2 },
        { id: 'v2', routeId: 'route_b', lon: 1, lat: 2 },
        { id: 'v3', tripId: 'trip_1', lon: 1, lat: 2 },
      ],
    };
    expect(getVisibleVehicles(state).map((v) => v.id).sort()).toEqual(['v1', 'v3']);
  });

  it('normalizes labels from route meta', () => {
    const out = normalizeVehicles(
      [{ id: 'v1', routeId: 'route_a', lon: 158.7, lat: 53.01 }],
      tripToRoute,
      routeMetaById,
    );
    expect(out[0].label).toBe('3');
    expect(out[0].routeType).toBe(3);
  });

  it('assigns minibus icon type from route meta', () => {
    const meta = new Map([['route_m', { shortName: '6к', routeType: 200 }]]);
    const out = normalizeVehicles(
      [{ id: 'v1', routeId: 'route_m', lon: 158.7, lat: 53.01 }],
      new Map(),
      meta,
    );
    expect(out[0].routeType).toBe(200);
  });
});

describe('routePath', () => {
  it('samples bearing along a path', () => {
    const path = shapePointsToPath([
      { shape_pt_lon: '158.70', shape_pt_lat: '53.01' },
      { shape_pt_lon: '158.71', shape_pt_lat: '53.02' },
    ]);
    const pos = samplePath(path, 0.5);
    expect(pos.lon).toBeCloseTo(158.705, 3);
    expect(pos.lat).toBeCloseTo(53.015, 3);
    expect(pos.bearing).toBeGreaterThan(0);
  });

  it('aligns bearing to nearest route segment', () => {
    const path = shapePointsToPath([
      { shape_pt_lon: '158.70', shape_pt_lat: '53.01' },
      { shape_pt_lon: '158.72', shape_pt_lat: '53.01' },
    ]);
    expect(bearingOnPath(path, 158.71, 53.01, null)).toBe(90);
    expect(bearingOnPath(path, 158.71, 53.01, 270)).toBe(270);
  });
});

describe('resolveVehicleBearing', () => {
  it('snaps bearing to route shape when available', () => {
    const shapeCtx = {
      firstShapeByRoute: new Map([['route_a', 'shape_1']]),
      shapesByShapeId: new Map([['shape_1', [
        { shape_pt_lon: '158.70', shape_pt_lat: '53.01' },
        { shape_pt_lon: '158.72', shape_pt_lat: '53.01' },
      ]]]),
    };
    const bearing = resolveVehicleBearing(
      { routeId: 'route_a', lon: 158.71, lat: 53.01, bearing: 0 },
      shapeCtx,
    );
    expect(bearing).toBe(90);
  });
});