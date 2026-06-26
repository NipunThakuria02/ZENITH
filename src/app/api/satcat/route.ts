import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
interface SatcatCounts {
  satellites: number;
  rocketBodies: number;
  debris: number;
  total: number;
  month: string;
  source: 'live' | 'cache' | 'fallback';
}

// ── Fallback (returned immediately on any failure or timeout) ──────────────
const FALLBACK: SatcatCounts = {
  satellites:   114,
  rocketBodies: 7,
  debris:       19,
  total:        140,
  month:        'June 2026',
  source:       'fallback',
};

// ── In-memory cache ────────────────────────────────────────────────────────
let cache: { data: SatcatCounts; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Helper: format month label ─────────────────────────────────────────────
function monthLabel(prefix: string): string {
  const [year, month] = prefix.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ── Parse SATCAT CSV (only called if live fetch succeeds) ──────────────────
function parseSatcat(csv: string, monthPrefix: string): SatcatCounts {
  const lines = csv.split('\n').filter(Boolean);
  if (lines.length < 2) return { ...FALLBACK, source: 'live' };

  // Header detection - find column indices
  const header = lines[0].split(',').map((h) => h.trim().toUpperCase());
  const launchIdx = header.findIndex(
    (h) => h === 'LAUNCH_DATE' || h === 'LAUNCH'
  );
  const typeIdx = header.findIndex((h) => h === 'OBJECT_TYPE');

  if (launchIdx === -1 || typeIdx === -1) {
    console.warn('[API satcat] Could not find required columns in header:', header);
    return { ...FALLBACK, source: 'live' };
  }

  let satellites = 0;
  let rocketBodies = 0;
  let debris = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= Math.max(launchIdx, typeIdx)) continue;

    const launch = (cols[launchIdx] ?? '').trim();
    if (!launch.startsWith(monthPrefix)) continue;

    const type = (cols[typeIdx] ?? '').trim().toUpperCase();
    if (type === 'PAY' || type === 'PLAT') {
      satellites++;
    } else if (type === 'R/B') {
      rocketBodies++;
    } else if (type === 'DEB') {
      debris++;
    }
  }

  return {
    satellites,
    rocketBodies,
    debris,
    total: satellites + rocketBodies + debris,
    month: monthLabel(monthPrefix),
    source: 'live',
  };
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function GET() {
  const now = Date.now();

  // Serve from cache if fresh
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache.data, source: 'cache' });
  }

  // Build current month prefix (e.g. "2026-06")
  const today = new Date();
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Attempt live fetch with a strict 4-second timeout
  try {
    const response = await fetch('https://celestrak.org/pub/satcat.csv', {
      headers: { 'User-Agent': 'ProjectZenith/1.0' },
      signal: AbortSignal.timeout(4_000),
    });

    if (!response.ok) throw new Error(`Celestrak HTTP ${response.status}`);

    const csv = await response.text();
    const counts = parseSatcat(csv, monthPrefix);

    // Cache the successful live result
    cache = { data: counts, fetchedAt: now };
    return NextResponse.json(counts);
  } catch (err) {
    // Fetch failed or timed out - return fallback immediately, do not block
    const label = err instanceof Error ? err.message : String(err);
    console.warn(`[API satcat] Live fetch failed (${label}), returning fallback`);
    return NextResponse.json(FALLBACK);
  }
}
