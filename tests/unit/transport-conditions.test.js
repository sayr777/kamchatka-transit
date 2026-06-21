import { describe, it, expect } from 'vitest';
import {
  parseGtfsTriState,
  mergeTriState,
  buildRouteConditionsIndex,
  filterRoutesByCondition,
  filterStopsByCondition,
  getRouteConditionTags,
  getStopConditionTags,
} from '../../src/utils/transportConditions.js';

const t = (key) => key;

describe('transportConditions', () => {
  it('parses GTFS tri-state', () => {
    expect(parseGtfsTriState('1')).toBe('yes');
    expect(parseGtfsTriState('2')).toBe('no');
    expect(parseGtfsTriState('')).toBe('unknown');
  });

  it('merges conflicting trip values to partial', () => {
    expect(mergeTriState('yes', '2')).toBe('partial');
    expect(mergeTriState('unknown', '1')).toBe('yes');
  });

  it('builds route conditions from trips and vehicles', () => {
    const trips = [
      { route_id: 'r1', wheelchair_accessible: '1', bikes_allowed: '2' },
      { route_id: 'r1', wheelchair_accessible: '2', bikes_allowed: '' },
    ];
    const vehicles = [
      { vehicle_id: 'v1', wheelchair: '1', low_floor: '1' },
    ];
    const vehicleTrips = [
      { route_id: 'r1', vehicle_id: 'v1' },
    ];
    const index = buildRouteConditionsIndex(trips, vehicles, vehicleTrips);
    expect(index.r1.wheelchair).toBe('partial');
    expect(index.r1.bikes).toBe('no');
    expect(index.r1.lowFloor).toBe('yes');
  });

  it('returns route tags when conditions are known', () => {
    const map = new Map([['r1', { wheelchair: 'yes', bikes: 'yes', lowFloor: 'yes' }]]);
    const tags = getRouteConditionTags('r1', map, t);
    expect(tags.map((x) => x.key)).toEqual(['route-wheelchair', 'route-bikes', 'route-lowfloor']);
  });

  it('returns stop tag for accessible boarding', () => {
    const tags = getStopConditionTags({ wheelchair_boarding: '1' }, t);
    expect(tags).toHaveLength(1);
    expect(tags[0].key).toBe('stop-wheelchair');
  });

  it('filters routes by wheelchair condition', () => {
    const routes = [{ route_id: 'r1' }, { route_id: 'r2' }, { route_id: 'r3' }];
    const map = new Map([
      ['r1', { wheelchair: 'yes', bikes: 'unknown', lowFloor: 'unknown' }],
      ['r2', { wheelchair: 'partial', bikes: 'unknown', lowFloor: 'unknown' }],
      ['r3', { wheelchair: 'no', bikes: 'unknown', lowFloor: 'unknown' }],
    ]);
    const filtered = filterRoutesByCondition(routes, map, 'wheelchair');
    expect(filtered.map((r) => r.route_id)).toEqual(['r1', 'r2']);
  });

  it('filters routes by low floor and bikes', () => {
    const routes = [{ route_id: 'r1' }, { route_id: 'r2' }];
    const map = new Map([
      ['r1', { wheelchair: 'unknown', bikes: 'yes', lowFloor: 'yes' }],
      ['r2', { wheelchair: 'unknown', bikes: 'no', lowFloor: 'unknown' }],
    ]);
    expect(filterRoutesByCondition(routes, map, 'lowFloor').map((r) => r.route_id)).toEqual(['r1']);
    expect(filterRoutesByCondition(routes, map, 'bikes').map((r) => r.route_id)).toEqual(['r1']);
  });

  it('filters wheelchair-accessible stops only for MGN filter', () => {
    const stops = [
      { stop_id: 's1', wheelchair_boarding: '1' },
      { stop_id: 's2', wheelchair_boarding: '0' },
      { stop_id: 's3', wheelchair_boarding: '' },
    ];
    expect(filterStopsByCondition(stops, 'wheelchair').map((s) => s.stop_id)).toEqual(['s1']);
    expect(filterStopsByCondition(stops, 'bikes')).toEqual([]);
  });
});