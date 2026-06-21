/**
 * Проверка языковых GTFS-фидов (en / zh / ja).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(__dirname, '../../public');

function parseCsvLine(line) {
  const values = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      let val = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { val += line[i++]; }
      }
      values.push(val);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { values.push(line.slice(i)); break; }
      values.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return values;
}

function firstStopName(dir) {
  const content = fs.readFileSync(path.join(PUBLIC, dir, 'stops.txt'), 'utf-8');
  const lines = content.trim().split('\n');
  const vals = parseCsvLine(lines[1]);
  return vals[1];
}

const LANGS = [
  { dir: 'gtfs_en', zip: 'gtfs_en.zip', sample: 'Construction Town', routeHint: '10 km marker' },
  { dir: 'gtfs_zh', zip: 'gtfs_cn.zip', sample: '建设城', routeHint: '10公里站' },
  { dir: 'gtfs_ja', zip: 'gtfs_jp.zip', sample: '建設町', routeHint: '10キロ地点' },
];

describe('Языковые GTFS-фиды', () => {
  for (const { dir, zip, sample, routeHint } of LANGS) {
    it(`${dir}/stops.txt переведён`, () => {
      expect(fs.existsSync(path.join(PUBLIC, dir, 'stops.txt'))).toBe(true);
      expect(firstStopName(dir)).toBe(sample);
    });

    it(`${zip} существует`, () => {
      expect(fs.existsSync(path.join(PUBLIC, zip))).toBe(true);
      expect(fs.statSync(path.join(PUBLIC, zip)).size).toBeGreaterThan(10_000);
    });

    it(`${dir}/routes.txt содержит перевод маршрутов`, () => {
      const routes = fs.readFileSync(path.join(PUBLIC, dir, 'routes.txt'), 'utf-8');
      expect(routes).toContain(routeHint);
      expect(routes).not.toContain('10 километр');
    });
  }

  it('русский и английский фиды различаются', () => {
    expect(firstStopName('gtfs')).not.toBe(firstStopName('gtfs_en'));
  });
});