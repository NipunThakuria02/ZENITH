'use client';

/**
 * src/app/sky/page.tsx
 *
 * New layout:
 *  - Sky dome ≈ 70% of viewport width (flex-1)
 *  - Fixed 240px right rail: Congestion score + live badge, Active/Debris tiles,
 *    Observability card, "Full analytics" drawer trigger
 *  - Thin bottom bar: Stars / Satellites / Constellations toggles (left) +
 *    data-source label (right)
 */

import dynamic from 'next/dynamic';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Observer, SatelliteResult, ObservabilityResult } from '@/types';
import { calculateObservability } from '@/lib/observability';

/* ── Dynamic imports ─────────────────────────────────────────────── */
const SkyDome = dynamic(() => import('@/components/SkyDome/SkyDome'), {
  ssr: false,
  loading: () => (
    <div style={{
      flex: 1, minHeight: 480,
      background: '#000008', borderRadius: '1.25rem',
      border: '1px solid rgba(0,212,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#3a5070', fontSize: '0.85rem', fontFamily: 'monospace',
    }}>
      Initialising sky dome…
    </div>
  ),
});

/* ── Tiny helpers ────────────────────────────────────────────────── */
type Source = 'live' | 'stale' | 'offline';

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function DataSourceBadge({ source, fetchedAt }: { source: Source; fetchedAt: number }) {
  useTick(30_000);
  const elapsed = Math.round((Date.now() - fetchedAt) / 60_000);
  const cfg = {
    live:    { dot: '#22c55e', glow: 'rgba(34,197,94,0.5)',   label: 'Live',                          bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)',   text: '#86efac' },
    stale:   { dot: '#f59e0b', glow: 'rgba(245,158,11,0.5)',  label: `Cached ${elapsed}m ago`,        bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)',  text: '#fcd34d' },
    offline: { dot: '#ef4444', glow: 'rgba(239,68,68,0.6)',   label: 'Feed offline — sample view',    bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.35)',   text: '#fca5a5' },
  }[source];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      padding: '0.25rem 0.7rem', borderRadius: '2rem',
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: '0.68rem', fontFamily: 'monospace', letterSpacing: '0.04em',
      color: cfg.text, userSelect: 'none', flexShrink: 0,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: cfg.dot, boxShadow: `0 0 6px ${cfg.glow}`,
        display: 'inline-block', flexShrink: 0,
        animation: source === 'live' ? 'pulse-ring 2s ease-out infinite' : 'none',
      }} />
      {cfg.label}
    </span>
  );
}

/* ── Full-analytics drawer ───────────────────────────────────────── */
function AnalyticsDrawer({
  open, onClose,
  satellites, observer,
}: {
  open: boolean;
  onClose: () => void;
  satellites: SatelliteResult[];
  observer: Observer;
}) {
  // Dynamic imports inside drawer (only mounted when opened)
  const [OrbitWidget, setOrbitWidget] = useState<React.ComponentType<{ satellites: SatelliteResult[] }> | null>(null);
  const [FootprintWidget, setFootprintWidget] = useState<React.ComponentType<{ satellites: SatelliteResult[] }> | null>(null);
  const [ChartWidget, setChartWidget] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (!open) return;
    import('@/components/Analytics/OrbitShellWidget').then(m => setOrbitWidget(() => m.default));
    import('@/components/Analytics/IndiaFootprintWidget').then(m => setFootprintWidget(() => m.default));
    import('@/components/Analytics/GrowthChart').then(m => setChartWidget(() => m.default));
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,8,0.72)', backdropFilter: 'blur(4px)',
      }} />
      {/* Drawer panel */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 101,
        width: 'min(640px, 92vw)',
        background: 'rgba(8,8,22,0.97)',
        borderLeft: '1px solid rgba(0,212,255,0.12)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
        animation: 'slideInRight 0.22s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.5rem',
          borderBottom: '1px solid rgba(0,212,255,0.08)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#00d4ff', fontWeight: 600 }}>
            Full Analytics
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.18)',
            borderRadius: '0.45rem', padding: '0.3rem 0.75rem',
            fontSize: '0.75rem', color: '#00d4ff', cursor: 'pointer',
          }}>✕ Close</button>
        </div>
        {/* Body */}
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {OrbitWidget    ? <OrbitWidget satellites={satellites} />      : <Skeleton label="Orbit Classification" />}
          {FootprintWidget ? <FootprintWidget satellites={satellites} /> : <Skeleton label="Regional Footprint" />}
          {ChartWidget     ? <ChartWidget />                              : <Skeleton label="Historical Trend" />}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div style={{
      borderRadius: '1rem', border: '1px solid rgba(0,212,255,0.08)',
      background: 'rgba(0,0,18,0.6)', padding: '1.5rem',
      color: '#3a5070', fontSize: '0.78rem',
      display: 'flex', alignItems: 'center', gap: '0.6rem',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: '#00d4ff',
        animation: 'pulse-ring 1.2s ease-out infinite', display: 'inline-block',
      }} />
      Loading {label}…
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
/*  Page                                                              */
/* ══════════════════════════════════════════════════════════════════ */
export default function SkyPage() {
  const router = useRouter();
  const [observer, setObserver] = useState<Observer | null>(null);

  // Satellite / data state
  const [satellites, setSatellites] = useState<SatelliteResult[]>([]);
  const [dataSource, setDataSource] = useState<Source>('live');
  const [tleFetchedAt, setTleFetchedAt] = useState<number>(Date.now());

  // Observability
  const [observability, setObservability] = useState<ObservabilityResult | null>(null);

  // Toggle state (owned at page level, passed to SkyDome)
  const [showStars, setShowStars] = useState(true);
  const [showSatellites, setShowSatellites] = useState(true);
  const [showConstellations, setShowConstellations] = useState(true); // = planets layer

  // Full-analytics drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Refresh trigger — increment to fire an immediate TLE re-fetch in SatelliteLayer
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  /* Read observer */
  useEffect(() => {
    const raw = window.localStorage.getItem('zenith_observer');
    if (!raw) { router.replace('/'); return; }
    try { setObserver(JSON.parse(raw) as Observer); }
    catch { router.replace('/'); }
  }, [router]);

  /* Observability */
  useEffect(() => {
    if (!observer) return;
    let active = true;
    setObservability(null);
    calculateObservability(observer).then(r => { if (active) setObservability(r); });
    return () => { active = false; };
  }, [observer]);

  /* Stable callbacks */
  const handleCountUpdate = useCallback(
    (_t: number, _a: number, _d: number, results?: SatelliteResult[]) => {
      setSatellites(results ?? []);
    },
    []
  );
  const handleDataSource = useCallback((src: Source, fetchedAt: number) => {
    setDataSource(src);
    setTleFetchedAt(fetchedAt);
    // Auto-clear refreshing spinner once we get a response
    setRefreshing(false);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshToken(t => t + 1);
  }, []);

  /* Derived counts */
  const total  = satellites.length;
  const active = satellites.filter(s =>
    s.category === 'active' || s.category === 'ISS' || s.category === 'starlink'
  ).length;
  const debris = satellites.filter(s => s.category === 'debris').length;
  const baseline = 5;
  const pctChange = Math.round(((total - baseline) / baseline) * 100);

  /* Loading */
  if (!observer) {
    return (
      <main style={{
        minHeight: '100vh', background: '#080810',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '1rem',
      }}>
        <span style={{
          width: 12, height: 12, borderRadius: '50%',
          background: '#00d4ff', boxShadow: '0 0 12px #00d4ff',
          animation: 'pulse-ring 1.5s ease-out infinite', display: 'inline-block',
        }} />
        <p style={{ color: '#3a5070', fontSize: '0.85rem', fontFamily: 'monospace' }}>
          Loading observer location…
        </p>
      </main>
    );
  }

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <main style={{
      minHeight: '100vh', height: '100vh',
      background: '#080810', color: '#e0e8ff',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Top nav ───────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid rgba(0,212,255,0.07)',
        background: 'rgba(8,8,16,0.95)',
        backdropFilter: 'blur(12px)',
        flexShrink: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#00d4ff', boxShadow: '0 0 8px #00d4ff',
            display: 'inline-block',
            animation: 'pulse-ring 2s ease-out infinite',
          }} />
          <span style={{
            fontSize: '0.68rem', letterSpacing: '0.28em',
            textTransform: 'uppercase', color: '#00d4ff', fontWeight: 600,
          }}>
            Project Zenith · Sky View
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#4a6080' }}>
            {observer.name}
          </span>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: '0.5rem', padding: '0.3rem 0.8rem',
              fontSize: '0.72rem', color: '#00d4ff', cursor: 'pointer',
            }}
          >
            ← Change Location
          </button>
        </div>
      </header>

      {/* ── Main body ─────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', gap: '1rem',
        padding: '0.9rem 1rem 0',
        overflow: 'hidden', minHeight: 0,
      }}>

        {/* Left: Sky dome — full width of left column */}
        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Header row: label + title on left, refresh button on right */}
          <div style={{ marginBottom: '0.45rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{
                fontSize: '0.6rem', letterSpacing: '0.28em',
                textTransform: 'uppercase', color: '#6080a0', margin: 0,
              }}>
                Live Sky Dome
              </p>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e0e8ff', margin: '0.1rem 0 0' }}>
                What&apos;s above{' '}
                <span style={{ color: '#00d4ff' }}>{observer.name.split(',')[0]}</span>
              </h1>
              {/* Offline hint statement */}
              {dataSource === 'offline' && (
                <p style={{
                  fontSize: '0.62rem', color: '#f87171',
                  margin: '0.2rem 0 0',
                  fontFamily: 'monospace',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}>
                  <span style={{ fontSize: '0.7rem' }}>⚠</span>
                  Feed is offline — showing sample data.
                  Click <strong style={{ color: '#fca5a5' }}>Refresh</strong> to reconnect to live data.
                </p>
              )}
            </div>
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title={dataSource === 'offline' ? 'Reconnect to live satellite feed' : 'Fetch latest TLE data'}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '0.6rem',
                border: dataSource === 'offline'
                  ? '1px solid rgba(239,68,68,0.55)'
                  : '1px solid rgba(0,212,255,0.22)',
                background: dataSource === 'offline'
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(0,212,255,0.07)',
                color: dataSource === 'offline' ? '#fca5a5' : '#00d4ff',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: refreshing ? 'wait' : 'pointer',
                opacity: refreshing ? 0.6 : 1,
                transition: 'all 0.15s',
                flexShrink: 0,
                boxShadow: dataSource === 'offline'
                  ? '0 0 12px rgba(239,68,68,0.2)'
                  : 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
                  fontSize: '0.9rem',
                  lineHeight: 1,
                }}
              >&#x21BB;</span>
              {refreshing ? 'Connecting…' : 'Refresh'}
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <SkyDome
              observer={observer}
              onCountUpdate={handleCountUpdate}
              onDataSourceChange={handleDataSource}
              dataSource={dataSource}
              showStars={showStars}
              showSatellites={showSatellites}
              showPlanets={showConstellations}
              refreshToken={refreshToken}
            />
          </div>
        </section>

        {/* Right: 240px fixed rail */}
        <aside style={{
          width: 240, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: '0.65rem',
          overflowY: 'auto',
        }}>

          {/* ── Congestion score card ─────────────────────────────── */}
          <div style={{
            background: 'rgba(10,10,24,0.92)',
            border: '1px solid rgba(0,212,255,0.12)',
            borderRadius: '1rem',
            padding: '0.9rem 1rem 1rem',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 30px rgba(0,212,255,0.04)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: '0.4rem',
            }}>
              <span style={{
                fontSize: '0.6rem', letterSpacing: '0.28em',
                textTransform: 'uppercase', color: '#00d4ff', fontWeight: 600,
              }}>
                Congestion Score
              </span>
              <DataSourceBadge source={dataSource} fetchedAt={tleFetchedAt} />
            </div>
            {/* Large numeral */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{
                fontSize: '3.4rem', fontWeight: 800, lineHeight: 1,
                color: '#e0e8ff', letterSpacing: '-0.02em',
                fontFamily: 'monospace',
              }}>
                {total}
              </span>
              <span style={{
                fontSize: '0.68rem', color: pctChange >= 0 ? '#22c55e' : '#ef4444',
                marginBottom: '0.5rem', fontFamily: 'monospace', fontWeight: 600,
              }}>
                {pctChange >= 0 ? '+' : ''}{pctChange}%{'\n'}since 2019
              </span>
            </div>
            <p style={{
              fontSize: '0.6rem', color: '#4a6080',
              textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0.3rem 0 0',
            }}>
              objects in zenith cone
            </p>
          </div>

          {/* ── Active / Debris stat tiles ────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{
              background: 'rgba(10,10,24,0.88)',
              border: '1px solid rgba(0,212,255,0.08)',
              borderRadius: '0.85rem', padding: '0.75rem 0.85rem',
              backdropFilter: 'blur(12px)',
            }}>
              <p style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3a8060', margin: '0 0 0.3rem' }}>
                Active
              </p>
              <p style={{ fontSize: '1.9rem', fontWeight: 700, color: '#4ade80', margin: 0, lineHeight: 1, fontFamily: 'monospace' }}>
                {active}
              </p>
            </div>
            <div style={{
              background: 'rgba(10,10,24,0.88)',
              border: '1px solid rgba(0,212,255,0.08)',
              borderRadius: '0.85rem', padding: '0.75rem 0.85rem',
              backdropFilter: 'blur(12px)',
            }}>
              <p style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#80403a', margin: '0 0 0.3rem' }}>
                Debris
              </p>
              <p style={{ fontSize: '1.9rem', fontWeight: 700, color: '#f87171', margin: 0, lineHeight: 1, fontFamily: 'monospace' }}>
                {debris}
              </p>
            </div>
          </div>

          {/* ── Observability card ────────────────────────────────── */}
          <div style={{
            background: 'rgba(10,10,24,0.92)',
            border: '1px solid rgba(0,212,255,0.10)',
            borderRadius: '1rem', padding: '0.9rem 1rem',
            backdropFilter: 'blur(16px)',
            flex: observability ? 'none' : 1,
          }}>
            <p style={{
              fontSize: '0.6rem', letterSpacing: '0.28em',
              textTransform: 'uppercase', color: '#00d4ff', fontWeight: 600,
              margin: '0 0 0.55rem',
            }}>
              Observability
            </p>
            {observability ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{
                    fontSize: '2.6rem', fontWeight: 800, lineHeight: 1,
                    color: '#e0e8ff', fontFamily: 'monospace',
                  }}>
                    {observability.score}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#8fa0ba', fontWeight: 600 }}>
                    {observability.rating}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
                  <InfoRow label="Bortle" value={`${observability.bortleScale} — ${observability.bortleLabel}`} />
                  <InfoRow label="Clouds" value={`${observability.cloudCoverPercent}%`} />
                  <InfoRow label="Moon"   value={`${observability.moonPercent}%`} />
                  <div style={{
                    marginTop: '0.35rem',
                    background: 'rgba(0,212,255,0.05)',
                    border: '1px solid rgba(0,212,255,0.1)',
                    borderRadius: '0.5rem', padding: '0.4rem 0.6rem',
                  }}>
                    <p style={{ fontSize: '0.58rem', color: '#4a7090', textTransform: 'uppercase', letterSpacing: '0.18em', margin: '0 0 0.2rem' }}>
                      Best window
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#c8d8ff', margin: 0, fontFamily: 'monospace' }}>
                      {observability.bestWindow}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                color: '#3a5070', fontSize: '0.72rem',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#00d4ff',
                  animation: 'pulse-ring 1.2s ease-out infinite', display: 'inline-block',
                }} />
                Loading…
              </div>
            )}
          </div>

          {/* ── Full analytics button ─────────────────────────────── */}
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              width: '100%',
              background: 'rgba(0,212,255,0.06)',
              border: '1px solid rgba(0,212,255,0.22)',
              borderRadius: '0.85rem',
              padding: '0.75rem 1rem',
              color: '#00d4ff',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background 0.15s, box-shadow 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.13)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 18px rgba(0,212,255,0.15)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.06)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: '1rem' }}>⎈</span>
            Full Analytics
          </button>

          {/* spacer */}
          <div style={{ flex: 1 }} />

          {/* ── Observer coords (bottom of rail) ─────────────────── */}
          <div style={{
            background: 'rgba(0,0,16,0.6)',
            border: '1px solid rgba(0,212,255,0.07)',
            borderRadius: '0.7rem', padding: '0.6rem 0.8rem',
            fontSize: '0.62rem', fontFamily: 'monospace', color: '#3a5070',
          }}>
            <span style={{ color: '#00d4ff', fontWeight: 600 }}>⊕ </span>
            {observer.name}<br />
            {Math.abs(observer.lat).toFixed(3)}°{observer.lat >= 0 ? 'N' : 'S'}{' '}
            {Math.abs(observer.lng).toFixed(3)}°{observer.lng >= 0 ? 'E' : 'W'}
          </div>
        </aside>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.5rem 1.1rem',
        borderTop: '1px solid rgba(0,212,255,0.07)',
        background: 'rgba(6,6,18,0.95)',
        backdropFilter: 'blur(12px)',
        gap: '1rem',
      }}>
        {/* Left: layer toggles */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1.25rem',
          fontSize: '0.72rem', fontFamily: '"Inter","Segoe UI",sans-serif', color: '#c8d8ff',
        }}>
          <span style={{
            fontSize: '0.58rem', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: '#00d4ff', fontWeight: 700,
          }}>
            Layers:
          </span>
          <ToggleCheckbox
            checked={showStars}
            onChange={setShowStars}
            accent="#00d4ff"
            label="★ Stars"
          />
          <ToggleCheckbox
            checked={showSatellites}
            onChange={setShowSatellites}
            accent="#00ff88"
            label="📡 Satellites"
          />
          <ToggleCheckbox
            checked={showConstellations}
            onChange={setShowConstellations}
            accent="#ffffc0"
            label="🪐 Planets"
          />
        </div>

        {/* Right: data-source label */}
        <DataSourceBadge source={dataSource} fetchedAt={tleFetchedAt} />
      </div>

      {/* ── Full analytics drawer ─────────────────────────────────── */}
      <AnalyticsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        satellites={satellites}
        observer={observer}
      />

      <style>{`
        @media (max-width: 700px) {
          .sky-rail { display: none !important; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

/* ── Sub-components ──────────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: '0.6rem', color: '#4a6080', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.68rem', color: '#8fa0ba', fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}

function ToggleCheckbox({
  checked, onChange, accent, label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accent: string;
  label: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', userSelect: 'none' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ cursor: 'pointer', accentColor: accent, width: 13, height: 13 }}
      />
      {label}
    </label>
  );
}
