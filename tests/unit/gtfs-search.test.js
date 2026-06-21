import { describe, it, expect } from 'vitest';
import {
  matchRoute,
  searchRoutes,
  searchStops,
  dedupeRoutesByShortName,
} from '../../src/utils/gtfsSearch.js';

const routes = [
  { route_id: 'r1', route_short_name: '3', route_long_name: '10 километр – Академика Королева' },
  { route_id: 'r2', route_short_name: '2', route_long_name: '10 километр - ул. Рябиковская' },
  { route_id: 'r3', route_short_name: '12', route_long_name: '10 километр - ул. Ларина' },
  { route_id: 'r4', route_short_name: '12', route_long_name: 'ул. Ларина - 10 километр' },
  { route_id: 'r5', route_short_name: '6к', route_long_name: '10 километр - Авача' },
];

describe('gtfsSearch', () => {
  it('finds single-digit routes', () => {
    expect(searchRoutes(routes, '2').map((r) => r.route_short_name)).toEqual(['2']);
    expect(searchRoutes(routes, '3').map((r) => r.route_short_name)).toEqual(['3']);
  });

  it('finds routes by long name fragment', () => {
    expect(searchRoutes(routes, '10').length).toBeGreaterThan(0);
    expect(searchRoutes(routes, 'ларина').map((r) => r.route_short_name)).toEqual(['12']);
  });

  it('dedupes opposite directions', () => {
    expect(searchRoutes(routes, '12')).toHaveLength(1);
    expect(dedupeRoutesByShortName(routes.filter((r) => r.route_short_name === '12'))).toHaveLength(1);
  });

  it('matches route number prefix', () => {
    expect(matchRoute(routes[4], '6')).toBe(true);
    expect(matchRoute(routes[4], '6к')).toBe(true);
  });

  it('searches stops', () => {
    const stops = [{ stop_name: 'ул. Ларина', stop_id: 's1' }];
    expect(searchStops(stops, 'лар')).toHaveLength(1);
  });
});