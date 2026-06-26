'use client';

/**
 * src/app/page.tsx — Phase 1: Location Selection
 *
 * Full-screen CesiumJS globe as background.
 * Glassmorphic panel overlay: search, quick-select cities, coord display, confirm.
 * On confirm → writes Observer to localStorage('zenith_observer') → routes to /sky.
 */

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Observer } from '@/types';

/* ── CesiumGlobe: SSR=false mandatory (accesses window on load) ── */
const CesiumGlobe = dynamic(
  () => import('@/components/Globe/CesiumGlobe'),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 loading-globe" aria-label="Loading globe…" />
    ),
  }
);

/* ── Quick-select city data ────────────────────────────────────── */
const QUICK_LOCATIONS = [
  { name: 'Mumbai',   country: 'India',         lat: 19.07,  lng:  72.87,  emoji: '🇮🇳' },
  { name: 'Chennai',  country: 'India',         lat: 13.08,  lng:  80.27,  emoji: '🇮🇳' },
  { name: 'Delhi',    country: 'India',         lat: 28.70,  lng:  77.10,  emoji: '🇮🇳' },
  { name: 'New York', country: 'United States', lat: 40.71,  lng: -74.00,  emoji: '🇺🇸' },
  { name: 'London',   country: 'United Kingdom',lat: 51.50,  lng:  -0.12,  emoji: '🇬🇧' },
  { name: 'Tokyo',    country: 'Japan',         lat: 35.68,  lng: 139.69,  emoji: '🇯🇵' },
] as const;

/* ── Tiny decorative star component ───────────────────────────── */
function StarField() {
  const stars = useRef(
    Array.from({ length: 60 }, (_, i) => ({
      id: i,
      top:  Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 4,
      dur:   Math.random() * 3 + 2,
    }))
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.current.map((s) => (
        <span
          key={s.id}
          style={{
            position: 'absolute',
            top:    `${s.top}%`,
            left:   `${s.left}%`,
            width:  `${s.size}px`,
            height: `${s.size}px`,
            borderRadius: '50%',
            background: '#a8d8ff',
            opacity: 0.15,
            animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Main page component ───────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();

  const [query,    setQuery]    = useState('');
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);
  const [activeCity, setActiveCity] = useState<string | null>('Mumbai');
  const [confirmed, setConfirmed] = useState(false);

  const [selected, setSelected] = useState<Observer>({
    lat:  19.07,
    lng:  72.87,
    alt:  0.05,
    name: 'Mumbai, India',
  });

  const inputRef = useRef<HTMLInputElement>(null);

  /* Sync active city highlight when selected changes externally (globe click) */
  useEffect(() => {
    const match = QUICK_LOCATIONS.find(
      (c) =>
        Math.abs(c.lat - selected.lat) < 0.5 &&
        Math.abs(c.lng - selected.lng) < 0.5
    );
    setActiveCity(match?.name ?? null);
  }, [selected.lat, selected.lng]);

  /* ── Globe click → update selected ─────────────────────────── */
  const handleGlobeSelect = useCallback(
    (loc: { lat: number; lng: number; name?: string }) => {
      setSelected({
        lat:  loc.lat,
        lng:  loc.lng,
        alt:  0.05,
        name: loc.name ?? `${loc.lat.toFixed(2)}°, ${loc.lng.toFixed(2)}°`,
      });
      setSearchMsg('Location picked from globe.');
      setTimeout(() => setSearchMsg(null), 2500);
    },
    []
  );

  /* ── Quick-select city ─────────────────────────────────────── */
  const handleQuickSelect = (
    lat: number,
    lng: number,
    name: string,
    country: string
  ) => {
    setSelected({ lat, lng, alt: 0.05, name: `${name}, ${country}` });
    setActiveCity(name);
    setSearchMsg(null);
    setQuery('');
  };

  /* ── Nominatim search ──────────────────────────────────────── */
  const handleSearch = async () => {
    const q = query.trim();
    if (!q) { inputRef.current?.focus(); return; }

    setSearching(true);
    setSearchMsg('Searching…');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        setSearchMsg('No results found. Try a different name.');
        return;
      }

      const place = data[0];
      setSelected({
        lat:  parseFloat(place.lat),
        lng:  parseFloat(place.lon),
        alt:  0.05,
        name: place.display_name,
      });
      setSearchMsg(null);
      setActiveCity(null);
    } catch {
      setSearchMsg('Search failed. Check your connection.');
    } finally {
      setSearching(false);
    }
  };

  /* ── Search on Enter key ───────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  /* ── Save to localStorage and route to /sky ───────────────── */
  const handleConfirm = () => {
    if (typeof window === 'undefined') return;
    setConfirmed(true);
    window.localStorage.setItem('zenith_observer', JSON.stringify(selected));

    /* Small delay so the button animation plays before navigation */
    setTimeout(() => router.push('/sky'), 350);
  };

  /* ── Coordinate display strings ────────────────────────────── */
  const latStr = `${Math.abs(selected.lat).toFixed(4)}° ${selected.lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(selected.lng).toFixed(4)}° ${selected.lng >= 0 ? 'E' : 'W'}`;

  return (
    <main
      id="zenith-home"
      className="relative min-h-screen overflow-hidden"
      style={{ background: '#080810' }}
    >
      {/* ── Globe fills the entire viewport ────────────────────── */}
      <div className="absolute inset-0">
        <CesiumGlobe
          selected={selected}
          onLocationSelect={handleGlobeSelect}
        />
      </div>

      {/* ── Decorative stars (only visible where globe is dark) ── */}
      <StarField />

      {/* ── Radial vignette to anchor panel ─────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 100% at 0% 50%, rgba(8,8,16,0.82) 0%, transparent 70%)',
        }}
      />

      {/* ── Main overlay layout ─────────────────────────────────── */}
      <div className="relative z-10 flex min-h-screen items-center px-4 py-8 sm:px-8 lg:px-14">

        <div className="w-full max-w-lg space-y-4">

          {/* ╔══ Header ══════════════════════════════════════════════╗ */}
          <header className="slide-up">
            <div className="flex items-center gap-2.5 mb-3">
              {/* Animated cyan dot */}
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: '#00d4ff',
                  boxShadow: '0 0 8px #00d4ff, 0 0 20px rgba(0,212,255,0.4)',
                  animation: 'pulse-ring 2s ease-out infinite',
                }}
              />
              <span
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.35em',
                  textTransform: 'uppercase',
                  color: '#00d4ff',
                  fontWeight: 600,
                }}
              >
                Project Zenith · The Celestial Eye
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.2rem)',
                fontWeight: 800,
                lineHeight: 1.1,
                color: '#fff',
                letterSpacing: '-0.02em',
              }}
            >
              Pick a location.
              <br />
              <span style={{ color: '#00d4ff' }}>See what is above you.</span>
            </h1>

            <p
              style={{
                marginTop: '0.75rem',
                fontSize: '0.95rem',
                color: '#6080a0',
                maxWidth: '36ch',
                lineHeight: 1.6,
              }}
            >
              Click anywhere on the globe, search by name, or choose a city below.
            </p>
          </header>

          {/* ╔══ Search bar ══════════════════════════════════════════╗ */}
          <div
            className="slide-up slide-up-d1"
            style={{
              background: 'rgba(15,15,26,0.85)',
              border: '1px solid rgba(0,212,255,0.1)',
              borderRadius: '1rem',
              padding: '1rem',
              backdropFilter: 'blur(20px)',
            }}
          >
            <label
              htmlFor="location-search"
              style={{
                display: 'block',
                fontSize: '0.65rem',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#6080a0',
                marginBottom: '0.6rem',
              }}
            >
              Search Location
            </label>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="location-search"
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Try Mumbai, Paris, Cape Town…"
                autoComplete="off"
                style={{
                  flex: 1,
                  background: 'rgba(8,8,16,0.9)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.65rem',
                  padding: '0.7rem 1rem',
                  fontSize: '0.9rem',
                  color: '#e0e8ff',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.5)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')
                }
              />

              <button
                id="search-btn"
                type="button"
                onClick={handleSearch}
                disabled={searching}
                style={{
                  background: searching
                    ? 'rgba(0,212,255,0.3)'
                    : 'linear-gradient(135deg, #00d4ff 0%, #0088cc 100%)',
                  border: 'none',
                  borderRadius: '0.65rem',
                  padding: '0.7rem 1.2rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: searching ? 'rgba(255,255,255,0.5)' : '#080810',
                  cursor: searching ? 'wait' : 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.03em',
                }}
              >
                {searching ? '…' : 'Search'}
              </button>
            </div>

            {searchMsg && (
              <p
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.8rem',
                  color: searchMsg.startsWith('No') || searchMsg.startsWith('Search failed')
                    ? '#ff6666'
                    : '#00d4ff',
                }}
              >
                {searchMsg}
              </p>
            )}
          </div>

          {/* ╔══ Quick-select city grid ══════════════════════════════╗ */}
          <div className="slide-up slide-up-d2">
            <p
              style={{
                fontSize: '0.65rem',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#6080a0',
                marginBottom: '0.6rem',
              }}
            >
              Quick Select
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
              }}
            >
              {QUICK_LOCATIONS.map((city) => {
                const isActive = activeCity === city.name;
                return (
                  <button
                    key={city.name}
                    id={`city-${city.name.toLowerCase().replace(' ', '-')}`}
                    type="button"
                    onClick={() =>
                      handleQuickSelect(city.lat, city.lng, city.name, city.country)
                    }
                    style={{
                      background: isActive
                        ? 'rgba(0,212,255,0.1)'
                        : 'rgba(15,15,26,0.75)',
                      border: `1px solid ${
                        isActive
                          ? 'rgba(0,212,255,0.5)'
                          : 'rgba(255,255,255,0.07)'
                      }`,
                      borderRadius: '0.75rem',
                      padding: '0.65rem 0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive
                        ? '0 0 16px rgba(0,212,255,0.12), inset 0 0 12px rgba(0,212,255,0.04)'
                        : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
                        e.currentTarget.style.background  = 'rgba(0,212,255,0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                        e.currentTarget.style.background  = 'rgba(15,15,26,0.75)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem' }}>{city.emoji}</span>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: isActive ? '#00d4ff' : '#e0e8ff',
                          transition: 'color 0.2s',
                        }}
                      >
                        {city.name}
                      </span>
                    </div>
                    <p
                      className="font-mono"
                      style={{ fontSize: '0.65rem', color: '#4a6080', margin: 0 }}
                    >
                      {city.lat.toFixed(2)}, {city.lng.toFixed(2)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ╔══ Selected observer panel ════════════════════════════╗ */}
          <div
            className="slide-up slide-up-d3 scanlines"
            style={{
              position: 'relative',
              background: 'rgba(0,212,255,0.04)',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: '1rem',
              padding: '1.1rem 1.25rem',
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}
          >
            {/* Glow strip */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              {/* Left: coordinates */}
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '0.65rem',
                    letterSpacing: '0.25em',
                    textTransform: 'uppercase',
                    color: '#6080a0',
                    marginBottom: '0.5rem',
                  }}
                >
                  Selected Observer
                </p>

                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '0.6rem', color: '#4a6080', display: 'block', marginBottom: 2 }}>LAT</span>
                    <span
                      className="font-mono"
                      style={{ fontSize: '1.15rem', fontWeight: 700, color: '#00d4ff', letterSpacing: '0.04em' }}
                    >
                      {latStr}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6rem', color: '#4a6080', display: 'block', marginBottom: 2 }}>LON</span>
                    <span
                      className="font-mono"
                      style={{ fontSize: '1.15rem', fontWeight: 700, color: '#00d4ff', letterSpacing: '0.04em' }}
                    >
                      {lngStr}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.78rem',
                    color: '#5070a0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '22ch',
                  }}
                  title={selected.name}
                >
                  {selected.name}
                </p>
              </div>

              {/* Right: altitude badge */}
              <div
                style={{
                  flexShrink: 0,
                  background: 'rgba(0,212,255,0.07)',
                  border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: '0.6rem',
                  padding: '0.45rem 0.75rem',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.58rem', color: '#4a6080', display: 'block', letterSpacing: '0.15em' }}>ALT</span>
                <span className="font-mono" style={{ fontSize: '0.85rem', color: '#8aaac0', fontWeight: 700 }}>
                  0.05 km
                </span>
              </div>
            </div>
          </div>

          {/* ╔══ Confirm button ══════════════════════════════════════╗ */}
          <div className="slide-up slide-up-d4">
            <button
              id="confirm-location-btn"
              type="button"
              onClick={handleConfirm}
              disabled={confirmed}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                borderRadius: '0.9rem',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: confirmed ? 'default' : 'pointer',
                color: confirmed ? 'rgba(8,8,16,0.6)' : '#080810',
                background: confirmed
                  ? 'rgba(0,212,255,0.4)'
                  : 'linear-gradient(135deg, #00d4ff 0%, #00aaee 50%, #0077cc 100%)',
                boxShadow: confirmed
                  ? 'none'
                  : '0 0 24px rgba(0,212,255,0.35), 0 4px 16px rgba(0,0,0,0.4)',
                transition: 'all 0.25s ease',
                transform: confirmed ? 'scale(0.98)' : 'scale(1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
              }}
              onMouseEnter={(e) => {
                if (!confirmed) {
                  e.currentTarget.style.boxShadow =
                    '0 0 40px rgba(0,212,255,0.5), 0 6px 24px rgba(0,0,0,0.5)';
                  e.currentTarget.style.transform = 'scale(1.015)';
                }
              }}
              onMouseLeave={(e) => {
                if (!confirmed) {
                  e.currentTarget.style.boxShadow =
                    '0 0 24px rgba(0,212,255,0.35), 0 4px 16px rgba(0,0,0,0.4)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {confirmed ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Launching…
                </>
              ) : (
                <>
                  Confirm Location
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>

            <p
              style={{
                textAlign: 'center',
                marginTop: '0.6rem',
                fontSize: '0.72rem',
                color: '#3a4a6a',
                letterSpacing: '0.05em',
              }}
            >
              Saves to localStorage · Routes to Sky View
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
