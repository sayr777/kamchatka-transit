import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GTFS_DIR = path.resolve(__dirname, '../public/gtfs');

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

function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim(); });
    return obj;
  });
}

const stops = parseCsv(path.join(GTFS_DIR, 'stops.txt'));
const routes = parseCsv(path.join(GTFS_DIR, 'routes.txt'));
const stopNames = [...new Set(stops.map((s) => s.stop_name))].sort();
const routeNames = [...new Set(routes.map((r) => r.route_long_name))].sort();

console.log('STOPS', stopNames.length);
for (const s of stopNames) console.log(s);
console.log('ROUTES', routeNames.length);
for (const r of routeNames) console.log(r);