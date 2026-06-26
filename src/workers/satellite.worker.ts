// src/workers/satellite.worker.ts
// PRE-WRITTEN — Do not modify the propagation logic or coordinate chain.
// This file runs in a Web Worker: no DOM, no React, no Next.js context.

import * as satellite from 'satellite.js';

interface TLEInput {
  name: string;
  line1: string;
  line2: string;
}

interface ObserverInput {
  lat: number;
  lng: number;
  alt: number;
}

export interface SatelliteResult {
  name: string;
  azimuth: number;
  elevation: number;
  range: number;
  category: 'ISS' | 'starlink' | 'active' | 'debris' | 'rocket';
  period: number;
}

self.onmessage = (e: MessageEvent<{ tles: TLEInput[]; observer: ObserverInput }>) => {
  const { tles, observer } = e.data;

  if (!tles || !observer) return;

  const now = new Date();
  const gmst = satellite.gstime(now);

  const observerGd = {
    longitude: satellite.degreesToRadians(observer.lng),
    latitude: satellite.degreesToRadians(observer.lat),
    height: observer.alt ?? 0.05,
  };

  const results: SatelliteResult[] = [];

  for (const tle of tles) {
    if (!tle.line1 || !tle.line2 || tle.line1.length < 69 || tle.line2.length < 69) {
      continue;
    }

    try {
      const satrec = satellite.twoline2satrec(tle.line1, tle.line2);
      const posVel = satellite.propagate(satrec, now);

      if (!posVel.position || typeof posVel.position === 'boolean') {
        continue;
      }

      const posEci = posVel.position as { x: number; y: number; z: number };
      if (isNaN(posEci.x) || isNaN(posEci.y) || isNaN(posEci.z)) continue;

      const posEcf = satellite.eciToEcf(posEci, gmst);
      const lookAngles = satellite.ecfToLookAngles(observerGd, posEcf);
      const elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);
      if (elevationDeg <= 0) continue;

      const azimuthDeg = satellite.radiansToDegrees(lookAngles.azimuth);
      const name = tle.name.trim().toUpperCase();

      const meanMotion = parseFloat(tle.line2.substring(52, 63));
      const periodMin = meanMotion > 0 ? 1440 / meanMotion : 0;

      let category: SatelliteResult['category'] = 'active';
      if (name.includes('ISS') || name.includes('ZARYA')) {
        category = 'ISS';
      } else if (name.includes('STARLINK')) {
        category = 'starlink';
      } else if (name.includes('DEB') || name.includes('DEBRIS')) {
        category = 'debris';
      } else if (name.includes('R/B') || name.includes('ROCKET')) {
        category = 'rocket';
      }

      results.push({
        name,
        azimuth: azimuthDeg,
        elevation: elevationDeg,
        range: lookAngles.rangeSat,
        category,
        period: periodMin,
      });
    } catch {
      // Skip malformed TLEs or propagation errors
    }
  }

  self.postMessage(results);
};
