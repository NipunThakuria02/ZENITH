'use client';

import { useEffect, useState } from 'react';
import type { SatelliteResult } from '@/types';

interface Props {
  satellites: SatelliteResult[]; // satellites currently above the horizon
}

interface IndiaStats {
  total: number;
  active: number;
  inactive: number;
  debris: number;
  rocketBodies: number;
  source: 'live' | 'cache' | 'fallback';
}

// Keywords covering all known ISRO satellite series
const INDIAN_KEYWORDS = [
  'INSAT', 'GSAT', 'CARTOSAT', 'RESOURCESAT', 'RISAT',
  'IRNSS', 'NAVIC', 'EOS', 'ASTROSAT', 'OCEANSAT',
  'SARAL', 'MICROSAT', 'THEOS', 'EMISAT', 'HysIS',
  'PSLV', // some TLEs are named by launcher
];

export default function IndiaFootprintWidget({ satellites }: Props) {
  const [stats, setStats]     = useState<IndiaStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch total India-in-orbit count from SATCAT
  useEffect(() => {
    fetch('/api/satcat/india')
      .then((r) => r.json())
      .then((d: IndiaStats) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Currently-visible Indian satellites above the horizon
  const visibleIndian = satellites.filter((s) => {
    const name = s.name.toUpperCase();
    return INDIAN_KEYWORDS.some((kw) => name.includes(kw.toUpperCase()));
  });

  return (
    <div className="rounded-[2rem] border border-cyan-400/10 bg-black/70 p-6 shadow-inner shadow-cyan-500/5">
      <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Regional footprint</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Indian Spacecraft</h2>

      {/* Total in orbit — from SATCAT */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-950/80 p-4">
          <p className="text-xs text-slate-400 mb-1">Active in Orbit</p>
          <p className="text-3xl font-extrabold text-cyan-300">
            {loading ? '—' : (stats?.active ?? '—')}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">ISRO operational</p>
        </div>
        <div className="rounded-2xl bg-slate-950/80 p-4">
          <p className="text-xs text-slate-400 mb-1">Total Objects</p>
          <p className="text-3xl font-extrabold text-white">
            {loading ? '—' : (stats?.total ?? '—')}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">inc. debris &amp; R/B</p>
        </div>
      </div>

      {/* Breakdown row */}
      {stats && (
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-400">
            {stats.active} active
          </span>
          <span className="rounded-full bg-slate-700/40 px-2.5 py-1 text-slate-400">
            {stats.inactive} inactive
          </span>
          {stats.rocketBodies > 0 && (
            <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-orange-400">
              {stats.rocketBodies} R/B
            </span>
          )}
          <span className="ml-auto rounded-full bg-slate-800/60 px-2 py-1 text-slate-500">
            {stats.source}
          </span>
        </div>
      )}

      {/* Currently visible above horizon */}
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-950/80 p-4">
        <div>
          <p className="text-sm font-semibold text-white">Visible Now</p>
          <p className="text-xs text-slate-400">ISRO assets above horizon</p>
        </div>
        <span className="text-3xl font-extrabold text-cyan-300">{visibleIndian.length}</span>
      </div>

      {visibleIndian.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Overhead assets:</p>
          <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
            {visibleIndian.map((sat, idx) => (
              <div key={idx} className="flex justify-between text-xs font-mono text-cyan-100/90 bg-slate-900/50 p-1 px-2 rounded">
                <span>{sat.name}</span>
                <span className="text-slate-400">El: {sat.elevation.toFixed(1)}°</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
