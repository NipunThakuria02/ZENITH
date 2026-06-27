'use client';

/**
 * src/components/SkyDome/SkyDome.tsx  — Phase 2
 *
 * Three.js sky dome viewed from inside a sphere.
 * Stars positioned from the real HYG v3 star catalog using accurate
 * RA/Dec → Az/El coordinate conversion for the observer's location.
 * SatelliteLayer and PlanetLayer receive the live scene ref.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';


import { azElToVector3, raDecToAzEl, classifyOrbit } from '@/lib/coordinates';
import type { Observer, SatelliteResult } from '@/types';
import SatelliteLayer from './SatelliteLayer';
import PlanetLayer from './PlanetLayer';
import SatelliteInfoCard from './SatelliteInfoCard';

/* ── Constants matching the PRD spec exactly ─────────────────────── */
const DOME_RADIUS = 500;
const STAR_RADIUS = 490;   // slightly inside the dome
// Local star catalog — regenerate any time: node scripts/update-stars.mjs
const STARS_URL = '/stars.json';
const SESSION_KEY = 'zenith_stars_v38';

interface Props {
  observer: Observer;
  onCountUpdate?: (total: number, active: number, debris: number, results?: SatelliteResult[]) => void;
  onDataSourceChange?: (source: 'live' | 'stale' | 'offline', fetchedAt: number) => void;
  dataSource?: 'live' | 'stale' | 'offline';
  /** Controlled from page — default true */
  showStars?: boolean;
  showSatellites?: boolean;
  showPlanets?: boolean;
  /** Increment this counter to trigger an immediate TLE re-fetch */
  refreshToken?: number;
  onSatelliteSelect?: (sat: SatelliteResult | null) => void;
}

/* ── Star entry shape from stars.json ───────────────────────────── */
interface StarEntry {
  ra: number; // decimal hours
  dec: number; // degrees
  mag: number;
  name?: string;
}

/* ── Build a THREE.Points object from stars.json entries ─────────── */
function buildStarPoints(
  stars: StarEntry[],
  observer: Observer,
  date: Date
): THREE.Points {
  type StarVec = { x: number; y: number; z: number; size: number };
  const vecs: StarVec[] = [];

  for (const star of stars) {
    if (star.mag > 6.5) continue;

    // ra is stored in decimal hours → × 15 = degrees
    const raDeg = star.ra * 15;
    const decDeg = star.dec;

    const { azimuth, elevation } = raDecToAzEl(
      raDeg, decDeg,
      observer.lat, observer.lng,
      date
    );

    if (elevation < -5) continue;

    const v = azElToVector3(azimuth, elevation, STAR_RADIUS);
    const size = Math.max(0.5, (6.5 - star.mag) * 0.8);
    vecs.push({ x: v.x, y: v.y, z: v.z, size });
  }

  const count = vecs.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  // Slight blue tint (#c8d8ff) for realistic star color
  const baseColor = new THREE.Color(0xc8d8ff);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = vecs[i].x;
    positions[i * 3 + 1] = vecs[i].y;
    positions[i * 3 + 2] = vecs[i].z;

    // Vary brightness slightly per star
    const brightness = 0.75 + Math.random() * 0.25;
    colors[i * 3] = baseColor.r * brightness;
    colors[i * 3 + 1] = baseColor.g * brightness;
    colors[i * 3 + 2] = baseColor.b * brightness;

    sizes[i] = vecs[i].size;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 2.0,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'star-layer';
  return points;
}

/* ── Fetch stars.json; check sessionStorage cache first ─────────── */
async function fetchStars(): Promise<StarEntry[]> {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) {
    try {
      return JSON.parse(cached) as StarEntry[];
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  const res = await fetch(STARS_URL);
  if (!res.ok) throw new Error(`[Zenith] stars.json fetch failed: ${res.status}`);
  const stars = (await res.json()) as StarEntry[];
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(stars));
  } catch {
    // sessionStorage quota exceeded — skip caching
  }
  return stars;
}

/* ── Horizon ring for visual reference ───────────────────────────── */
function buildHorizonRing(): THREE.Line {
  const segments = 128;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      Math.cos(angle) * DOME_RADIUS * 0.98,
      -2,
      Math.sin(angle) * DOME_RADIUS * 0.98
    ));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: 0x00d4ff,
    transparent: true,
    opacity: 0.18,
  });
  return new THREE.Line(geo, mat);
}

/* ── Cardinal direction labels (N / E / S / W) ───────────────────── */
function buildCardinalLabels(): THREE.Group {
  const group = new THREE.Group();
  const labels = [
    { text: 'N', az: 0 },
    { text: 'E', az: 90 },
    { text: 'S', az: 180 },
    { text: 'W', az: 270 },
  ];

  labels.forEach(({ text, az }) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = 'bold 40px monospace';
    ctx.fillStyle = 'rgba(0,212,255,0.7)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
    );
    sprite.scale.set(60, 30, 1);

    // Place at horizon level
    const v = azElToVector3(az, 1, DOME_RADIUS * 0.9);
    sprite.position.copy(v);
    group.add(sprite);
  });

  return group;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  SkyDome Component                                                  */
/* ═══════════════════════════════════════════════════════════════════ */

export default function SkyDome({
  observer,
  onCountUpdate,
  onDataSourceChange,
  dataSource,
  showStars = true,
  showSatellites = true,
  showPlanets = true,
  refreshToken = 0,
  onSatelliteSelect,
}: Props) {
  const [selectedSat, setSelectedSat] = useState<SatelliteResult | null>(null);

  const handleSatelliteSelect = (sat: SatelliteResult | null) => {
    setSelectedSat(sat);
    if (onSatelliteSelect) {
      onSatelliteSelect(sat);
    }
  };

  const getAltitudeKm = (periodMin: number) => {
    const GM = 3.986004418e14; // m³/s²
    const T = periodMin * 60; // convert minutes to seconds
    const a = Math.cbrt((GM * T * T) / (4 * Math.PI * Math.PI)); // semi-major axis in metres
    return Math.round((a - 6371000) / 1000); // subtract Earth radius
  };
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Refs shared with child layers
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const starPointsRef = useRef<THREE.Points | null>(null);

  const [sceneReady, setSceneReady] = useState(false);
  const [starStatus, setStarStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [starCount, setStarCount] = useState(0);

  /* ── Initialise Three.js renderer, scene, controls (runs once) ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Scene ───────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    if (typeof window !== 'undefined') {
      (window as any).__three_scene = scene;
    }

    // ── Camera ─ exact PRD spec: position (0, 0, 0.001) ────────────
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.0001, 2000);
    camera.position.set(0, 0, 0.001);

    // ── Renderer ────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000008, 1);
    renderer.domElement.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;';
    container.appendChild(renderer.domElement);

    // ── Dome sphere (invisible, BackSide for inside-view) ───────────
    const domeMesh = new THREE.Mesh(
      new THREE.SphereGeometry(DOME_RADIUS, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x000011,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.0,
      })
    );
    domeMesh.name = 'dome';
    scene.add(domeMesh);

    // ── Horizon ring + cardinal labels ───────────────────────────────
    scene.add(buildHorizonRing());
    scene.add(buildCardinalLabels());

    // ── OrbitControls — exact PRD spec ──────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.minDistance = 0.001;
    controls.maxDistance = 0.001;
    controls.rotateSpeed = -0.3;       // negative = natural inside-sphere feel
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // ── Animation loop ───────────────────────────────────────────────
    let rafId = 0;
    function animate() {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ── Resize handler ───────────────────────────────────────────────
    function onResize() {
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();
      renderer.setSize(cw, ch);
    }
    window.addEventListener('resize', onResize);

    // ── Scroll-to-zoom (FOV-based, like a telescope) ──
    const MIN_FOV = 20;  // maximum zoom-in (narrow angle)
    const MAX_FOV = 90;  // maximum zoom-out (wide angle, slightly wider than default 75°)
    function onWheel(e: WheelEvent) {
      e.preventDefault();           // stop page scroll
      e.stopPropagation();
      const delta = e.deltaY * 0.05;
      camera.fov = Math.min(MAX_FOV, Math.max(MIN_FOV, camera.fov + delta));
      camera.updateProjectionMatrix();
    }
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Expose refs to child components
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    controlsRef.current = controls;
    if (typeof window !== 'undefined') {
      (window as any).__three_scene = scene;
      (window as any).__three_camera = camera;
      (window as any).__three_renderer = renderer;
    }
    setSceneReady(true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('wheel', onWheel);
      controls.dispose();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else (obj.material as THREE.Material).dispose();
        }
        if (obj instanceof THREE.Sprite) obj.material.dispose();
      });
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      setSceneReady(false);
    };
  }, []); // ← empty deps: three.js scene is created once

  /* ── Load star catalog and add to scene ──────────────────────── */
  useEffect(() => {
    if (!sceneReady || !sceneRef.current) return;
    const scene = sceneRef.current;
    let cancelled = false;

    setStarStatus('loading');

    fetchStars()
      .then((stars) => {
        if (cancelled || !sceneRef.current) return;

        const now = new Date();
        const points = buildStarPoints(stars, observer, now);
        points.visible = showStars;

        // Remove any previous star layer
        const old = scene.getObjectByName('star-layer');
        if (old) {
          scene.remove(old);
          (old as THREE.Points).geometry.dispose();
          ((old as THREE.Points).material as THREE.Material).dispose();
        }

        scene.add(points);
        starPointsRef.current = points;

        setStarCount(points.geometry.attributes.position.count);
        setStarStatus('ready');
        console.log(`[Zenith] Stars rendered: ${points.geometry.attributes.position.count}`);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[Zenith] Stars fetch failed:', err);
        setStarStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [sceneReady, observer.lat, observer.lng]); // re-run if location changes

  // Toggle star visibility
  useEffect(() => {
    if (starPointsRef.current) {
      starPointsRef.current.visible = showStars;
    }
  }, [showStars]);

  /* ── UI ─────────────────────────────────────────────────────────── */
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '65vh',
        minHeight: '440px',
        background: '#000008',
        borderRadius: '1.5rem',
        overflow: 'hidden',
        border: '1px solid rgba(0,212,255,0.1)',
      }}
    >
      {/* Three.js canvas mounts here */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Child layers — add directly into the THREE scene */}
      {sceneReady && sceneRef.current && (
        <>
          <SatelliteLayer
            scene={sceneRef.current}
            camera={cameraRef.current}
            renderer={rendererRef.current}
            observer={observer}
            onCountUpdate={(total, active, debris, results) => {
              if (onCountUpdate) onCountUpdate(total, active, debris, results);
            }}
            onDataSourceChange={onDataSourceChange}
            visible={showSatellites}
            refreshToken={refreshToken}
            onSatelliteSelect={handleSatelliteSelect}
            selectedSatName={selectedSat?.name ?? null}
          />
          <PlanetLayer scene={sceneRef.current} observer={observer} visible={showPlanets} />
        </>
      )}

      {/* ── Loading overlay ───────────────────────────────────────── */}
      {starStatus === 'loading' && (
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,16,0.8)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '2rem',
            padding: '0.5rem 1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.78rem',
            color: '#6080a0',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{
            display: 'inline-block',
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#00d4ff',
            animation: 'pulse-ring 1.2s ease-out infinite',
          }} />
          Loading HYG star catalog…
        </div>
      )}

      {/* ── Offline vignette — unmistakable red haze when feed is down ─── */}
      {dataSource === 'offline' && (
        <>
          {/* Full-dome red radial vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              borderRadius: '1.5rem',
              background:
                'radial-gradient(ellipse at center, transparent 35%, rgba(220,30,30,0.18) 70%, rgba(220,30,30,0.42) 100%)',
              zIndex: 4,
            }}
          />
          {/* Top border pulse */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              borderRadius: '1.5rem',
              border: '2px solid rgba(220,30,30,0.55)',
              boxShadow: '0 0 32px rgba(220,30,30,0.25) inset, 0 0 18px rgba(220,30,30,0.18)',
              zIndex: 5,
            }}
          />
          {/* Top-left corner ribbon banner */}
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(180,20,20,0.82)',
              border: '1px solid rgba(255,80,80,0.5)',
              borderRadius: '0.55rem',
              padding: '0.3rem 0.75rem',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 12px rgba(200,20,20,0.35)',
            }}
          >
            <span style={{
              width: 7, height: 7,
              borderRadius: '50%',
              background: '#ff5555',
              boxShadow: '0 0 6px #ff5555',
              display: 'inline-block',
              animation: 'pulse-ring 1.5s ease-out infinite',
            }} />
            <span style={{
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              letterSpacing: '0.15em',
              color: '#ffaaaa',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}>FEED OFFLINE — SAMPLE VIEW</span>
          </div>
        </>
      )}

      {selectedSat && (
        <SatelliteInfoCard
          sat={selectedSat}
          altitudeKm={getAltitudeKm(selectedSat.period)}
          orbitClass={classifyOrbit(selectedSat.period)}
          onClose={() => handleSatelliteSelect(null)}
        />
      )}

      {starStatus === 'ready' && (
        <div
          style={{
            position: 'absolute',
            top: '0.85rem',
            right: '0.85rem',
            background: 'rgba(0,0,16,0.78)',
            border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: '0.6rem',
            padding: '0.45rem 0.75rem',
            fontSize: '0.68rem',
            fontFamily: 'monospace',
            color: '#7090b0',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 600, color: '#8fa0ba', borderBottom: '1px solid rgba(0,212,255,0.1)', paddingBottom: '0.15rem', marginBottom: '0.15rem' }}>
            ★ {starCount.toLocaleString()} stars
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#00ff88' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 4px #00ff88', display: 'inline-block' }} />
            Active Payload
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#00d4ff' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 4px #00d4ff', display: 'inline-block' }} />
            Starlink
          </div>
        </div>
      )}

      {/* Checkboxes are now in the page-level bottom bar — SkyDome is purely a viewport */}

      {/* ── Observer footer bar ───────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: '0.85rem',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          background: 'rgba(0,0,16,0.78)',
          border: '1px solid rgba(0,212,255,0.12)',
          borderRadius: '2rem',
          padding: '0.45rem 1.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.75rem',
          backdropFilter: 'blur(10px)',
          color: '#5070a0',
        }}
      >
        <span>
          <span style={{ color: '#00d4ff', fontWeight: 600 }}>⊕</span>{' '}
          {observer.name}
        </span>
        <span style={{ fontFamily: 'monospace', color: '#3a5070' }}>|</span>
        <span style={{ fontFamily: 'monospace' }}>
          {Math.abs(observer.lat).toFixed(4)}°{observer.lat >= 0 ? 'N' : 'S'}{' '}
          {Math.abs(observer.lng).toFixed(4)}°{observer.lng >= 0 ? 'E' : 'W'}
        </span>
      </div>
    </div>
  );
}
