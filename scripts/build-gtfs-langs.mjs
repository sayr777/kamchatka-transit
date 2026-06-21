/**
 * Сборка языковых GTFS-фидов из public/gtfs/ (ru).
 * Создаёт public/gtfs_{lang}/ и public/gtfs_{zip}.zip для ru/en/zh/ja.
 *
 * Usage: node scripts/build-gtfs-langs.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import {
  STOPS,
  translateStop,
  translateRoute,
  translateAgency,
  FEED_LANG,
} from './gtfs-translations.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'public', 'gtfs');

const LANG_OUTPUTS = [
  { lang: 'ru', dir: 'gtfs', zip: 'gtfs_ru.zip' },
  { lang: 'en', dir: 'gtfs_en', zip: 'gtfs_en.zip' },
  { lang: 'zh', dir: 'gtfs_zh', zip: 'gtfs_cn.zip' },
  { lang: 'ja', dir: 'gtfs_ja', zip: 'gtfs_jp.zip' },
];

const TRANSLATABLE = new Set(['stops.txt', 'routes.txt', 'agency.txt', 'feed_info.txt']);

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

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(nonEmpty[0]).map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = nonEmpty.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
  return { headers, rows };
}

function escapeCsv(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function serializeCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

function translateFile(name, content, lang) {
  if (!TRANSLATABLE.has(name) || lang === 'ru') return content;

  const { headers, rows } = parseCsv(content);
  if (headers.length === 0) return content;

  for (const row of rows) {
    if (name === 'stops.txt' && row.stop_name) {
      row.stop_name = translateStop(row.stop_name.trim(), lang);
      if (row.tts_stop_name) row.tts_stop_name = translateStop(row.tts_stop_name.trim(), lang);
    }
    if (name === 'routes.txt' && row.route_long_name) {
      row.route_long_name = translateRoute(row.route_long_name.trim(), lang);
    }
    if (name === 'agency.txt') {
      if (row.agency_name) row.agency_name = translateAgency(row.agency_name.trim(), lang);
      if (row.agency_lang) row.agency_lang = FEED_LANG[lang];
    }
    if (name === 'feed_info.txt') {
      if (row.feed_publisher_name) {
        row.feed_publisher_name = translateAgency(row.feed_publisher_name.trim(), lang);
      }
      if (row.feed_lang) row.feed_lang = FEED_LANG[lang];
      if (row.default_lang) row.default_lang = FEED_LANG[lang];
    }
  }

  return serializeCsv(headers, rows);
}

async function buildLang({ lang, dir, zip }) {
  const outDir = path.join(ROOT, 'public', dir);
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.txt'));
  const jszip = new JSZip();

  let missing = [];
  const ruStops = parseCsv(fs.readFileSync(path.join(SRC_DIR, 'stops.txt'), 'utf-8'));

  for (const file of files) {
    const raw = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
    const translated = translateFile(file, raw, lang);
    fs.writeFileSync(path.join(outDir, file), translated, 'utf-8');
    jszip.file(file, translated);
  }

  if (lang !== 'ru') {
    for (const row of ruStops.rows) {
      const ruName = row.stop_name?.trim();
      if (ruName && !STOPS[ruName]) missing.push(ruName);
    }
  }

  const buf = await jszip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(path.join(ROOT, 'public', zip), buf);

  return { lang, dir, zip, files: files.length, missing: [...new Set(missing)] };
}

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error('Source not found:', SRC_DIR);
    process.exit(1);
  }

  const results = [];
  for (const spec of LANG_OUTPUTS) {
    results.push(await buildLang(spec));
  }

  // also refresh legacy gtfs.zip (ru)
  fs.copyFileSync(path.join(ROOT, 'public', 'gtfs_ru.zip'), path.join(ROOT, 'public', 'gtfs.zip'));

  console.log('GTFS language feeds built:');
  for (const r of results) {
    console.log(`  ${r.lang}: public/${r.dir}/ (${r.files} files) → public/${r.zip}`);
    if (r.missing.length) {
      console.warn(`    ⚠ untranslated stops (${r.missing.length}):`, r.missing.slice(0, 5).join(', '));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});