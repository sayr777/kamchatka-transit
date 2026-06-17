/**
 * Тесты целостности GTFS-данных.
 * Читает файлы из public/gtfs/ и проверяет их структуру и консистентность.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_DIR = path.resolve(__dirname, '../../public/gtfs');

/** Разбирает одну строку RFC-4180 CSV в массив значений */
function parseCsvLine(line) {
  const values = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      // quoted field
      let val = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      values.push(val);
      if (line[i] === ',') i++;
    } else {
      // unquoted field
      const end = line.indexOf(',', i);
      if (end === -1) { values.push(line.slice(i)); break; }
      values.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return values;
}

/** Разбирает CSV-файл GTFS в массив объектов */
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
    return obj;
  });
}

let stops, routes, trips, stopTimes, calendar;

beforeAll(() => {
  stops     = parseCsv(path.join(GTFS_DIR, 'stops.txt'));
  routes    = parseCsv(path.join(GTFS_DIR, 'routes.txt'));
  trips     = parseCsv(path.join(GTFS_DIR, 'trips.txt'));
  stopTimes = parseCsv(path.join(GTFS_DIR, 'stop_times.txt'));
  calendar  = parseCsv(path.join(GTFS_DIR, 'calendar.txt'));
});

// ── Файлы существуют ──────────────────────────────────────────

describe('GTFS файлы существуют', () => {
  const required = ['stops.txt','routes.txt','trips.txt','stop_times.txt','calendar.txt','agency.txt'];
  for (const file of required) {
    it(file, () => {
      expect(fs.existsSync(path.join(GTFS_DIR, file))).toBe(true);
    });
  }
});

// ── stops.txt ─────────────────────────────────────────────────

describe('stops.txt', () => {
  it('не пустой', () => expect(stops.length).toBeGreaterThan(0));

  it('обязательные поля присутствуют', () => {
    for (const s of stops) {
      expect(s.stop_id, `stop_id пуст у строки`).toBeTruthy();
      expect(s.stop_name, `stop_name пуст у ${s.stop_id}`).toBeTruthy();
    }
  });

  it('координаты в диапазоне Камчатки', () => {
    for (const s of stops) {
      const lat = parseFloat(s.stop_lat);
      const lon = parseFloat(s.stop_lon);
      expect(lat, `lat у ${s.stop_id}`).toBeGreaterThan(50);
      expect(lat, `lat у ${s.stop_id}`).toBeLessThan(62);
      expect(lon, `lon у ${s.stop_id}`).toBeGreaterThan(154);
      expect(lon, `lon у ${s.stop_id}`).toBeLessThan(168);
    }
  });

  it('stop_id уникальны', () => {
    const ids = stops.map(s => s.stop_id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('содержит ПКЧ-остановки', () => {
    const names = stops.map(s => s.stop_name.toLowerCase());
    // Хотя бы одна остановка содержит известное название
    const hasPKC = names.some(n => n.includes('площадь') || n.includes('ленина') || n.includes('камгу'));
    expect(hasPKC).toBe(true);
  });
});

// ── routes.txt ────────────────────────────────────────────────

describe('routes.txt', () => {
  it('не пустой', () => expect(routes.length).toBeGreaterThan(0));

  it('обязательные поля присутствуют', () => {
    for (const r of routes) {
      expect(r.route_id, 'route_id пуст').toBeTruthy();
      expect(r.route_short_name, `route_short_name пуст у ${r.route_id}`).toBeTruthy();
    }
  });

  it('route_type — допустимые значения GTFS', () => {
    const validTypes = new Set(['0','1','2','3','4','5','6','7','11','12']);
    for (const r of routes) {
      expect(validTypes.has(r.route_type), `неверный route_type "${r.route_type}" у ${r.route_id}`).toBe(true);
    }
  });

  it('route_id уникальны', () => {
    const ids = routes.map(r => r.route_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('route_color — валидный HEX (если задан)', () => {
    for (const r of routes) {
      if (r.route_color) {
        expect(r.route_color).toMatch(/^[0-9A-Fa-f]{6}$/);
      }
    }
  });
});

// ── trips.txt ─────────────────────────────────────────────────

describe('trips.txt', () => {
  it('не пустой', () => expect(trips.length).toBeGreaterThan(0));

  it('обязательные поля присутствуют', () => {
    for (const tr of trips.slice(0, 100)) {
      expect(tr.trip_id, 'trip_id пуст').toBeTruthy();
      expect(tr.route_id, `route_id пуст у ${tr.trip_id}`).toBeTruthy();
      expect(tr.service_id, `service_id пуст у ${tr.trip_id}`).toBeTruthy();
    }
  });

  it('trip_id уникальны', () => {
    const ids = trips.map(t => t.trip_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('все route_id из trips ссылаются на существующие маршруты', () => {
    const routeIds = new Set(routes.map(r => r.route_id));
    const orphans = trips.filter(t => !routeIds.has(t.route_id));
    expect(orphans.length, `рейсы без маршрута: ${orphans.slice(0,3).map(t=>t.trip_id).join(', ')}`).toBe(0);
  });
});

// ── stop_times.txt ────────────────────────────────────────────

describe('stop_times.txt', () => {
  it('не пустой', () => expect(stopTimes.length).toBeGreaterThan(0));

  it('обязательные поля в первых 200 записях', () => {
    for (const st of stopTimes.slice(0, 200)) {
      expect(st.trip_id, 'trip_id пуст').toBeTruthy();
      expect(st.stop_id, `stop_id пуст у ${st.trip_id}`).toBeTruthy();
      expect(st.stop_sequence, `stop_sequence пуст у ${st.trip_id}`).toBeTruthy();
    }
  });

  it('arrival_time в формате HH:MM:SS', () => {
    const sample = stopTimes.slice(0, 100).filter(st => st.arrival_time);
    for (const st of sample) {
      expect(st.arrival_time).toMatch(/^\d{1,2}:\d{2}:\d{2}$/);
    }
  });

  it('stop_sequence возрастает внутри рейса (проверка первого рейса)', () => {
    const firstTripId = stopTimes[0]?.trip_id;
    if (!firstTripId) return;
    const tripSt = stopTimes
      .filter(st => st.trip_id === firstTripId)
      .map(st => parseInt(st.stop_sequence));
    for (let i = 1; i < tripSt.length; i++) {
      expect(tripSt[i]).toBeGreaterThan(tripSt[i-1]);
    }
  });

  it('все stop_id из stop_times существуют в stops.txt', () => {
    const stopIds = new Set(stops.map(s => s.stop_id));
    const sample = stopTimes.slice(0, 500);
    const orphans = sample.filter(st => !stopIds.has(st.stop_id));
    expect(orphans.length).toBe(0);
  });
});

// ── calendar.txt ──────────────────────────────────────────────

describe('calendar.txt', () => {
  it('не пустой', () => expect(calendar.length).toBeGreaterThan(0));

  it('поля дней недели содержат 0 или 1', () => {
    const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
    for (const row of calendar) {
      for (const day of days) {
        expect(['0','1']).toContain(row[day]);
      }
    }
  });

  it('start_date ≤ end_date', () => {
    for (const row of calendar) {
      if (row.start_date && row.end_date) {
        expect(row.start_date <= row.end_date,
          `start_date ${row.start_date} > end_date ${row.end_date}`).toBe(true);
      }
    }
  });

  it('даты в формате YYYYMMDD', () => {
    for (const row of calendar) {
      if (row.start_date) expect(row.start_date).toMatch(/^\d{8}$/);
      if (row.end_date) expect(row.end_date).toMatch(/^\d{8}$/);
    }
  });
});

// ── Кросс-файловая консистентность ───────────────────────────

describe('Консистентность данных', () => {
  it('маршруты из trips покрывают не менее 80% routes.txt', () => {
    const routeIdsInTrips = new Set(trips.map(t => t.route_id));
    const coverage = routeIdsInTrips.size / routes.length;
    expect(coverage).toBeGreaterThanOrEqual(0.8);
  });

  it('среднее число рейсов на маршрут > 1', () => {
    const avgTrips = trips.length / routes.length;
    expect(avgTrips).toBeGreaterThan(1);
  });

  it('среднее число остановок в расписании > 5', () => {
    const tripIds = new Set(trips.map(t => t.trip_id));
    const avgStops = stopTimes.length / tripIds.size;
    expect(avgStops).toBeGreaterThan(5);
  });
});
