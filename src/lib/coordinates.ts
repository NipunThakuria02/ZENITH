// src/lib/coordinates.ts
// PRE-WRITTEN — Do not modify the sign or order of X, Y, Z components.
// These functions define the exact mapping between astronomical coordinates
// and Three.js positions inside the sky dome sphere.

import * as THREE from 'three';

export function azElToVector3(
  azimuthDeg: number,
  elevationDeg: number,
  radius: number = 490
): THREE.Vector3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;

  const cosEl = Math.cos(el);
  const x = radius * cosEl * Math.sin(az);
  const y = radius * Math.sin(el);
  const z = -radius * cosEl * Math.cos(az);

  return new THREE.Vector3(x, y, z);
}

export function raDecToAzEl(
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lngDeg: number,
  date: Date
): { azimuth: number; elevation: number } {
  const lstRad = localSiderealTime(lngDeg, date);
  const raRad = (raDeg * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const latRad = (latDeg * Math.PI) / 180;

  const ha = lstRad - raRad;

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(ha);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz =
    (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad)) /
    (Math.cos(alt) * Math.cos(latRad));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

  return {
    azimuth: (az * 180) / Math.PI,
    elevation: (alt * 180) / Math.PI,
  };
}

function localSiderealTime(lngDeg: number, date: Date): number {
  const J2000 = 2451545.0;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - J2000) / 36525.0;

  const gmst =
    280.46061837 +
    360.98564736629 * (jd - J2000) +
    T * T * 0.000387933;
  const lst = ((gmst + lngDeg) % 360 + 360) % 360;

  return (lst * Math.PI) / 180;
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function classifyOrbit(periodMinutes: number): 'LEO' | 'MEO' | 'GEO' | 'HEO' {
  if (periodMinutes < 128) return 'LEO';
  if (periodMinutes < 760) return 'MEO';
  if (periodMinutes < 1500) return 'GEO';
  return 'HEO';
}
