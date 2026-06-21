import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVehicleIconUrl,
  resolveVehicleIconType,
  SVG_BY_TYPE,
  clearVehicleIconCache,
} from '../../src/components/Map/vehicleIcons.js';

describe('vehicleIcons', () => {
  beforeEach(() => clearVehicleIconCache());

  it('maps GTFS route types to distinct SVG builders', () => {
    expect(SVG_BY_TYPE[3]).toBeTypeOf('function');
    expect(SVG_BY_TYPE[11]).toBeTypeOf('function');
    expect(SVG_BY_TYPE[200]).toBeTypeOf('function');
    expect(SVG_BY_TYPE[3]).not.toBe(SVG_BY_TYPE[200]);
    expect(SVG_BY_TYPE[3]).not.toBe(SVG_BY_TYPE[11]);
  });

  it('returns cached data-uri icons per type and color', () => {
    const bus = getVehicleIconUrl(3, '#ff0000');
    const minibus = getVehicleIconUrl(200, '#ff0000');
    const trolley = getVehicleIconUrl(11, '#ff0000');
    const bus2 = getVehicleIconUrl(3, '#ff0000');
    expect(bus).toMatch(/^data:image\/svg\+xml,/);
    expect(minibus).toMatch(/^data:image\/svg\+xml,/);
    expect(bus).toBe(bus2);
    expect(bus).not.toBe(minibus);
    expect(trolley).not.toBe(bus);
    expect(decodeURIComponent(bus)).toContain('viewBox="0 0 48 48"');
    expect(decodeURIComponent(trolley)).toContain('stroke="#484848"');
    expect(decodeURIComponent(minibus)).not.toBe(decodeURIComponent(bus));
  });

  it('resolves icon type from route meta', () => {
    expect(resolveVehicleIconType({ routeType: 11 }, null)).toBe(11);
    expect(resolveVehicleIconType({ routeType: 200 }, null)).toBe(200);
    expect(resolveVehicleIconType({ routeType: 3 }, null)).toBe(3);
    expect(resolveVehicleIconType(null, null)).toBe(3);
  });

  it('prefers vehicle_type from vehicles.txt when mapped', () => {
    expect(resolveVehicleIconType({ routeType: 3 }, { vehicleType: 11 })).toBe(11);
  });
});