import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface TLEEntry { name: string; line1: string; line2: string; }

export type SatelliteSource = 'live' | 'stale' | 'offline';

export interface SatelliteAPIResponse {
  source: SatelliteSource;
  fetchedAt: number; // ms since epoch — so frontend can compute "Xm ago"
  tles: TLEEntry[];
}

let tleCache: { data: TLEEntry[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function parseTLEText(text: string): TLEEntry[] {
  const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const tles: TLEEntry[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    tles.push({ name: lines[i], line1: lines[i + 1], line2: lines[i + 2] });
  }
  return tles;
}

export async function GET() {
  const now = Date.now();

  // ── Fresh in-memory cache (real data, not yet expired) ──────────────────
  if (tleCache && now - tleCache.fetchedAt < CACHE_TTL_MS) {
    const body: SatelliteAPIResponse = { source: 'live', fetchedAt: tleCache.fetchedAt, tles: tleCache.data };
    return NextResponse.json(body);
  }

  // ── Attempt live fetch from CelesTrak ───────────────────────────────────
  try {
    const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle', {
      headers: { 'User-Agent': 'ProjectZenith/1.0' },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error(`Celestrak HTTP ${response.status}`);

    const tles = parseTLEText(await response.text());
    tleCache = { data: tles, fetchedAt: now };

    const body: SatelliteAPIResponse = { source: 'live', fetchedAt: now, tles };
    return NextResponse.json(body);

  } catch (err) {
    console.warn('[API Satellites] Primary live fetch failed:', (err as Error).message);

    // ── Secondary attempt: GitHub active TLE mirror ───────────────────────
    try {
      console.log('[API Satellites] Attempting secondary fetch from GitHub mirror...');
      const response = await fetch('https://raw.githubusercontent.com/mrmykey/tlecdn/main/active.txt', {
        headers: { 'User-Agent': 'ProjectZenith/1.0' },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const tles = parseTLEText(await response.text());
        tleCache = { data: tles, fetchedAt: now };
        console.log(`[API Satellites] Successfully fetched ${tles.length} TLEs from GitHub mirror.`);
        const body: SatelliteAPIResponse = { source: 'live', fetchedAt: now, tles };
        return NextResponse.json(body);
      }
      console.warn(`[API Satellites] GitHub mirror fetch returned HTTP ${response.status}`);
    } catch (mirrorErr) {
      console.warn('[API Satellites] GitHub mirror fetch failed:', (mirrorErr as Error).message);
    }

    // ── Stale cache (real data, just old — legitimate degradation) ─────────
    if (tleCache) {
      const body: SatelliteAPIResponse = { source: 'stale', fetchedAt: tleCache.fetchedAt, tles: tleCache.data };
      return NextResponse.json(body, {
        headers: { 'X-Cache': 'STALE' },
      });
    }

    // ── Offline fallback (synthetic placeholder — NOT real positions) ───────
    try {
      const filePath = path.join(process.cwd(), 'public/tle_fallback.txt');
      if (fs.existsSync(filePath)) {
        const tles = parseTLEText(fs.readFileSync(filePath, 'utf8'));
        // Do NOT seed tleCache here — offline data must not pollute real cache
        console.warn(`[API Satellites] Serving OFFLINE placeholder (${tles.length} synthetic TLEs)`);
        const body: SatelliteAPIResponse = { source: 'offline', fetchedAt: now, tles };
        return NextResponse.json(body, {
          headers: { 'X-Cache': 'OFFLINE' },
        });
      }
    } catch (fallbackErr) {
      console.error('[API Satellites] Offline fallback read failed:', fallbackErr);
    }

    // ── Total failure ────────────────────────────────────────────────────
    const body: SatelliteAPIResponse = { source: 'offline', fetchedAt: now, tles: [] };
    return NextResponse.json(body, { status: 503 });
  }
}
