/**
 * scripts/update-stars.mjs
 *
 * Run with:  node scripts/update-stars.mjs
 *
 * Downloads the HYG v3 star catalog (gzip), decompresses it, filters to
 * mag < 6.5 (naked-eye stars), and writes a compact JSON to public/stars.json.
 *
 * To use a different catalog URL, edit SOURCE_URLS below.
 * The first URL that returns HTTP 200 is used.
 * Supports both plain .csv and gzip .csv.gz URLs automatically.
 *
 * Output format  (array of objects):
 *   { ra: number,   // right ascension in HOURS (multiply × 15 for degrees)
 *     dec: number,  // declination in degrees
 *     mag: number,  // apparent magnitude
 *     name?: string }
 */

import https from 'https';
import http  from 'http';
import zlib  from 'zlib';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE  = path.resolve(__dirname, '../public/stars.json');

// ── Edit these URLs to change the source catalog ──────────────────────────
// Files ending in .gz are automatically decompressed.
const SOURCE_URLS = [
  // HYG v3.8 (latest v3) — gzip compressed
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v38.csv.gz',
  // HYG v3.6 fallback
  'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v36_1.csv.gz',
  // Plain CSV fallback (older mirror — may 404)
  'https://raw.githubusercontent.com/astronexus/HYG-Database/master/hygdata_v3.csv',
];

const MAG_LIMIT = 6.5;   // naked-eye limit (change to 5.0 for fewer, brighter stars)

// ── HTTP helper — returns a Buffer ────────────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Zenith/1.0 star-catalog-updater' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Lightweight CSV parser (handles quoted fields) ────────────────────────
function parseCSV(text) {
  const lines  = text.split('\n');
  // Strip surrounding quotes from each field
  const strip  = (s) => s.trim().replace(/^"|"$/g, '');
  const header = lines[0].split(',').map(strip);
  const rows   = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < header.length) continue;
    const obj = {};
    header.forEach((h, j) => { obj[h] = strip(cols[j] ?? ''); });
    rows.push(obj);
  }
  return rows;
}


// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  let csvText = null;

  for (const url of SOURCE_URLS) {
    try {
      console.log(`Trying ${url} ...`);
      const buf = await fetchBuffer(url);
      console.log(`  Got ${(buf.length / 1024).toFixed(0)} KB raw`);

      if (url.endsWith('.gz')) {
        const decompressed = zlib.gunzipSync(buf);
        csvText = decompressed.toString('utf8');
        console.log(`  Decompressed to ${(csvText.length / 1024 / 1024).toFixed(1)} MB`);
      } else {
        csvText = buf.toString('utf8');
      }
      break;
    } catch (e) {
      console.warn(`  FAIL: ${e.message}`);
    }
  }

  if (!csvText) {
    console.error('\nAll sources failed. public/stars.json was NOT updated.');
    process.exit(1);
  }

  console.log('Parsing CSV ...');
  const rows = parseCSV(csvText);

  const stars = [];
  for (const row of rows) {
    const mag = parseFloat(row['mag']);
    if (isNaN(mag) || mag > MAG_LIMIT) continue;
    const ra  = parseFloat(row['ra']);
    const dec = parseFloat(row['dec']);
    if (isNaN(ra) || isNaN(dec)) continue;

    const entry = { ra, dec, mag };
    const name = (row['proper'] || '').trim();
    if (name) entry.name = name;
    stars.push(entry);
  }

  // Sort brightest first (handy for debugging / future LOD rendering)
  stars.sort((a, b) => a.mag - b.mag);

  const json = JSON.stringify(stars);
  fs.writeFileSync(OUT_FILE, json, 'utf8');
  console.log(`\nWrote ${stars.length} stars to ${OUT_FILE}`);
  console.log(`File size: ${(json.length / 1024).toFixed(0)} KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
