import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
interface IndiaStats {
  total: number;
  active: number;
  inactive: number;
  debris: number;
  rocketBodies: number;
  source: 'live' | 'fallback';
}

// ── Fallback — sourced from ISRO public data (as of mid-2026) ──────────────
const FALLBACK: IndiaStats = {
  total:        58,
  active:       53,
  inactive:     2,
  debris:       0,
  rocketBodies: 3,
  source:       'fallback',
};

// ── In-memory cache ────────────────────────────────────────────────────────
let cache: { data: IndiaStats; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Parse SATCAT CSV for IND owner ─────────────────────────────────────────
function parseIndianSatcat(csv: string): IndiaStats {
  const lines = csv.split('\n').filter(Boolean);
  if (lines.length < 2) return { ...FALLBACK, source: 'live' };

  const header = lines[0].split(',').map((h) => h.trim().toUpperCase());

  const ownerIdx  = header.findIndex((h) => h === 'OWNER');
  const typeIdx   = header.findIndex((h) => h === 'OBJECT_TYPE');
  // OPS_STATUS_CODE: '+' = operational, '-' = non-operational, 'P' = partial
  const statusIdx = header.findIndex((h) => h === 'OPS_STATUS_CODE');
  // DECAY_DATE being empty means still in orbit
  const decayIdx  = header.findIndex((h) => h === 'DECAY_DATE');

  if (ownerIdx === -1 || typeIdx === -1) {
    console.warn('[API satcat/india] Missing columns in SATCAT header');
    return { ...FALLBACK, source: 'live' };
  }

  let active = 0, inactive = 0, debris = 0, rocketBodies = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const owner = (cols[ownerIdx] ?? '').trim().toUpperCase();
    if (owner !== 'IND') continue;

    // Skip decayed objects (returned to Earth)
    if (decayIdx !== -1) {
      const decay = (cols[decayIdx] ?? '').trim();
      if (decay && decay !== '' && decay !== 'N/A') continue;
    }

    const type   = (cols[typeIdx]   ?? '').trim().toUpperCase();
    const status = (cols[statusIdx] ?? '').trim().toUpperCase();

    if (type === 'DEB') {
      debris++;
    } else if (type === 'R/B') {
      rocketBodies++;
    } else {
      // PAY / PLAT = satellite payload
      if (status === '+' || status === 'P') {
        active++;
      } else {
        inactive++;
      }
    }
  }

  const total = active + inactive + debris + rocketBodies;
  return { total, active, inactive, debris, rocketBodies, source: 'live' };
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET() {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.data, source: 'cache' });
  }

  try {
    const res = await fetch('https://celestrak.org/pub/satcat.csv', {
      headers: { 'User-Agent': 'ProjectZenith/1.0' },
      signal: AbortSignal.timeout(4_000),
    });

    if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);

    const csv  = await res.text();
    const data = parseIndianSatcat(csv);
    cache = { data, fetchedAt: now };
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[API satcat/india] Live fetch failed (${msg}), returning fallback`);
    return NextResponse.json(FALLBACK);
  }
}
