import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import historicalData from '@/data/satcat-historical.json';

export default function GrowthChart() {
  return (
    <div className="rounded-[2rem] border border-cyan-400/10 bg-black/70 p-6">
      <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Historical trend</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">Zenith object growth</h2>
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={historicalData} margin={{ top: 15, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1c2a44" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', color: '#fff' }} />
            <ReferenceLine x={2019} stroke="#ff4444" strokeDasharray="3 3" label={{ value: '2019 Baseline', fill: '#ff4444', position: 'top', fontSize: 10 }} />
            <Line type="monotone" dataKey="total" stroke="#00d4ff" strokeWidth={3} dot={{ fill: '#00d4ff', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
