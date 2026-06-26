import type { SatelliteResult } from '@/types';

interface Props {
  satellites: SatelliteResult[];
}

export default function OrbitShellWidget({ satellites }: Props) {
  // Classification: LEO < 128 min, MEO 128–760 min, GEO 760–1500 min
  const leo = satellites.filter((s) => s.period < 128).length;
  const meo = satellites.filter((s) => s.period >= 128 && s.period < 760).length;
  const geo = satellites.filter((s) => s.period >= 760 && s.period <= 1500).length;

  return (
    <div className="rounded-[2rem] border border-cyan-400/10 bg-black/70 p-6 shadow-inner shadow-cyan-500/5">
      <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Orbit Classification</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Orbital shells</h2>
      
      <div className="mt-6 space-y-4">
        {/* LEO */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-950/80 p-3 px-4">
          <div>
            <p className="text-sm font-semibold text-white">LEO (Low Earth Orbit)</p>
            <p className="text-xs text-slate-400">Period &lt; 128 min</p>
          </div>
          <span className="text-2xl font-bold text-cyan-300">{leo}</span>
        </div>

        {/* MEO */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-950/80 p-3 px-4">
          <div>
            <p className="text-sm font-semibold text-white">MEO (Medium Earth Orbit)</p>
            <p className="text-xs text-slate-400">Period 128–760 min</p>
          </div>
          <span className="text-2xl font-bold text-emerald-300">{meo}</span>
        </div>

        {/* GEO */}
        <div className="flex items-center justify-between rounded-2xl bg-slate-950/80 p-3 px-4">
          <div>
            <p className="text-sm font-semibold text-white">GEO (Geostationary Orbit)</p>
            <p className="text-xs text-slate-400">Period 760–1500 min</p>
          </div>
          <span className="text-2xl font-bold text-rose-300">{geo}</span>
        </div>
      </div>
    </div>
  );
}
