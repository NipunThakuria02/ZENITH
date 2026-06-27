'use client';

/**
 * src/components/SkyDome/SatelliteLayer.tsx
 *
 * Spawns satellite.worker.ts via webpack-5 native worker syntax.
 * Fetches TLEs from /api/satellites every 10 s, posts { tles, observer }
 * to the worker, receives SatelliteResult[] back, renders as THREE.Points.
 * Calls onCountUpdate(total, active, debris) after every worker response.
 *
 * API response shape: { source: 'live' | 'stale' | 'offline', tles: TLEEntry[] }
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { azElToVector3 } from '@/lib/coordinates';
import type { Observer } from '@/types';
import type { SatelliteResult } from '@/workers/satellite.worker';

interface Props {
  scene: THREE.Scene;
  camera: THREE.Camera | null;
  renderer: THREE.WebGLRenderer | null;
  observer: Observer;
  onCountUpdate: (total: number, active: number, debris: number, results?: SatelliteResult[]) => void;
  onDataSourceChange?: (source: 'live' | 'stale' | 'offline', fetchedAt: number) => void;
  visible?: boolean;
  /** Increment to trigger an immediate re-fetch outside the normal interval */
  refreshToken?: number;
  onSatelliteSelect?: (sat: SatelliteResult | null) => void;
  selectedSatName: string | null;
}

type SatCategory = SatelliteResult['category'];

const CATEGORY_COLORS: Record<SatCategory, number> = {
  ISS: 0xffffff, // white
  starlink: 0x00d4ff, // cyan
  active: 0x00ff88, // green
  debris: 0xff4444, // red (#ff4444)
  rocket: 0xff8800, // orange (#ff8800)
};

function buildPoints(results: SatelliteResult[]): THREE.Points {
  const count = results.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  results.forEach((sat, i) => {
    const v = azElToVector3(sat.azimuth, sat.elevation, 480);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;

    const hex = CATEGORY_COLORS[sat.category] ?? 0xff8800;
    const c = new THREE.Color(hex);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 9.0,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });

  const pts = new THREE.Points(geo, mat);
  return pts;
}

export default function SatelliteLayer({
  scene,
  camera,
  renderer,
  observer,
  onCountUpdate,
  onDataSourceChange,
  visible,
  refreshToken,
  onSatelliteSelect,
  selectedSatName,
}: Props) {
  const groupRef = useRef<THREE.Group | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const highlightRef = useRef<THREE.Mesh | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  // Must be declared before the main useEffect so it's in scope when that effect assigns to it
  const refreshFnRef = useRef<(() => void) | null>(null);

  const onCountUpdateRef = useRef(onCountUpdate);
  const onDataSourceChangeRef = useRef(onDataSourceChange);
  const onSatelliteSelectRef = useRef(onSatelliteSelect);
  const selectedSatNameRef = useRef(selectedSatName);

  // Keep visibility and cached results in refs to prevent stale closures in the worker message handler
  const visibleRef = useRef(visible);
  const lastResultsRef = useRef<SatelliteResult[]>([]);

  useEffect(() => {
    onSatelliteSelectRef.current = onSatelliteSelect;
  }, [onSatelliteSelect]);

  useEffect(() => {
    selectedSatNameRef.current = selectedSatName;
  }, [selectedSatName]);

  useEffect(() => {
    onCountUpdateRef.current = onCountUpdate;
  }, [onCountUpdate]);

  useEffect(() => {
    onDataSourceChangeRef.current = onDataSourceChange;
  }, [onDataSourceChange]);

  useEffect(() => {
    visibleRef.current = visible;
    
    if (groupRef.current) {
      groupRef.current.visible = visible !== false;
    }

    if (visible !== false) {
      // Rebuild points immediately if we have cached results and no active points
      if (!pointsRef.current && lastResultsRef.current.length > 0 && groupRef.current) {
        const pts = buildPoints(lastResultsRef.current);
        groupRef.current.add(pts);
        pointsRef.current = pts;
      }
    } else {
      // Remove and dispose points when toggled off to ensure they don't linger or flash
      if (pointsRef.current && groupRef.current) {
        groupRef.current.remove(pointsRef.current);
        pointsRef.current.geometry.dispose();
        const m = pointsRef.current.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose();
        pointsRef.current = null;
      }
      onSatelliteSelectRef.current?.(null);
    }
  }, [visible]);

  useEffect(() => {
    if (!scene) return;
    mountedRef.current = true;

    // ── Create scene group ─────────────────────────────────────────
    const group = new THREE.Group();
    group.name = 'satellite-layer';
    group.visible = visible !== false; // Set initial visibility matching current prop state
    scene.add(group);
    groupRef.current = group;

    // ── Spawn the Web Worker ───────────────────────────────────────
    let worker: Worker;
    try {
      worker = new Worker(
        new URL('../../workers/satellite.worker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;
    } catch (err) {
      console.error('[SatelliteLayer] Worker spawn failed:', err);
      return;
    }

    // ── Handle worker responses ────────────────────────────────────
    worker.onmessage = (e: MessageEvent<SatelliteResult[]>) => {
      if (!mountedRef.current) return;
      const results = e.data;
      lastResultsRef.current = results; // cache results

      // Remove old points
      if (pointsRef.current) {
        group.remove(pointsRef.current);
        pointsRef.current.geometry.dispose();
        const m = pointsRef.current.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose();
        pointsRef.current = null;
      }

      // Only build and add if currently visible
      if (results.length > 0 && visibleRef.current !== false) {
        const pts = buildPoints(results);
        group.add(pts);
        pointsRef.current = pts;
      }

      // Count totals and call up to parent
      const total = results.length;
      const active = results.filter((s) => s.category === 'active' || s.category === 'ISS' || s.category === 'starlink').length;
      const debris = results.filter((s) => s.category === 'debris').length;
      onCountUpdateRef.current(total, active, debris, results);

      // Handle selection updates on TLE refreshes
      if (selectedSatNameRef.current) {
        const updated = results.find((s) => s.name === selectedSatNameRef.current);
        if (updated) {
          if (highlightRef.current) {
            const v = azElToVector3(updated.azimuth, updated.elevation, 480);
            highlightRef.current.position.copy(v);
            highlightRef.current.visible = true;
          }
          onSatelliteSelectRef.current?.(updated);
        } else {
          onSatelliteSelectRef.current?.(null);
        }
      }
    };

    worker.onerror = (err) => {
      console.error('[SatelliteLayer] Worker error:', err);
    };

    // ── Fetch TLEs and post to worker ──────────────────────────────
    async function refresh() {
      if (!mountedRef.current) return;
      try {
        const res = await fetch('/api/satellites');
        if (!res.ok) {
          console.warn('[SatelliteLayer] API fetch non-ok status:', res.status);
          return;
        }
        const json = await res.json() as { source: 'live' | 'stale' | 'offline'; fetchedAt: number; tles: unknown[] };
        const { source, fetchedAt, tles } = json;
        console.log(`[SatelliteLayer] source=${source} tles=${tles.length}`);
        if (source === 'offline') {
          console.warn('[SatelliteLayer] ⚠️  OFFLINE MODE — synthetic placeholder data, not real positions');
        }
        onDataSourceChangeRef.current?.(source, fetchedAt);
        if (!mountedRef.current) return;
        workerRef.current?.postMessage({ tles, observer });
      } catch (err) {
        console.error('[SatelliteLayer] API fetch error:', err);
      }
    }

    refresh();
    timerRef.current = setInterval(refresh, 10_000);

    // Store refresh fn on ref so refreshToken effect can call it
    refreshFnRef.current = refresh;

    // ── Click Selection & Raycasting ───────────────────────────────
    let startX = 0;
    let startY = 0;

    const handleMouseDown = (e: MouseEvent) => {
      startX = e.clientX;
      startY = e.clientY;
    };

    const handleMouseUp = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Ignore click logic if cursor was dragged (e.g., camera rotation)
      if (dist < 4) {
        performRaycast(e);
      }
    };

    const performRaycast = (event: MouseEvent) => {
      if (!pointsRef.current || !camera || !renderer) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.params.Points.threshold = 2.5;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObject(pointsRef.current);
      if (intersects.length > 0) {
        const index = intersects[0].index;
        if (index !== undefined && index >= 0 && lastResultsRef.current[index]) {
          const clickedSat = lastResultsRef.current[index];
          console.log('[SatelliteLayer] Selected satellite:', clickedSat.name);
          onSatelliteSelectRef.current?.(clickedSat);
          return;
        }
      }

      // Deselect if clicking on empty space
      console.log('[SatelliteLayer] Clicked empty space, clearing selection');
      onSatelliteSelectRef.current?.(null);
    };

    const dom = renderer?.domElement;
    if (dom) {
      dom.addEventListener('mousedown', handleMouseDown);
      dom.addEventListener('mouseup', handleMouseUp);
    }

    // ── Cleanup ────────────────────────────────────────────────────
    return () => {
      console.log('[SatelliteLayer] Cleanup effect called, removing group:', group.uuid);
      mountedRef.current = false;

      if (dom) {
        dom.removeEventListener('mousedown', handleMouseDown);
        dom.removeEventListener('mouseup', handleMouseUp);
      }

      if (timerRef.current) clearInterval(timerRef.current);
      worker.terminate();
      workerRef.current = null;

      if (pointsRef.current) {
        group.remove(pointsRef.current);
        pointsRef.current.geometry.dispose();
        const m = pointsRef.current.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose();
        pointsRef.current = null;
      }

      if (highlightRef.current) {
        group.remove(highlightRef.current);
        highlightRef.current.geometry.dispose();
        (highlightRef.current.material as THREE.Material).dispose();
        highlightRef.current = null;
      }

      scene.remove(group);
      console.log('[SatelliteLayer] Removed group from scene. Remaining scene children count:', scene.children.length);
      groupRef.current = null;
    };
  }, [scene, camera, renderer, observer]);

  // ── Trigger immediate re-fetch when refreshToken changes ──────────
  useEffect(() => {
    if (refreshToken && refreshToken > 0 && refreshFnRef.current) {
      console.log('[SatelliteLayer] Manual refresh triggered, token:', refreshToken);
      refreshFnRef.current();
    }
  }, [refreshToken]);

  // ── Handle highlight mesh updates based on selectedSatName changes ──
  useEffect(() => {
    if (!scene || !groupRef.current) return;
    const group = groupRef.current;

    if (!selectedSatName) {
      if (highlightRef.current) {
        group.remove(highlightRef.current);
        highlightRef.current.geometry.dispose();
        (highlightRef.current.material as THREE.Material).dispose();
        highlightRef.current = null;
      }
      return;
    }

    if (!highlightRef.current) {
      const geo = new THREE.SphereGeometry(3, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'satellite-highlight';
      group.add(mesh);
      highlightRef.current = mesh;
    }

    const sat = lastResultsRef.current.find((s) => s.name === selectedSatName);
    if (sat) {
      const v = azElToVector3(sat.azimuth, sat.elevation, 480);
      highlightRef.current.position.copy(v);
      highlightRef.current.visible = true;
    } else {
      highlightRef.current.visible = false;
    }
  }, [selectedSatName, scene]);

  return null;
}
