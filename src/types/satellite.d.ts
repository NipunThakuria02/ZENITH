// src/types/satellite.d.ts
// Manual type declarations for satellite.js — no @types/satellite.js on npm.
// See: https://github.com/shashwatak/satellite-js

declare module 'satellite.js' {
  export interface SatRec {
    error: number;
    [key: string]: unknown;
  }

  export interface EciVec3<T> {
    x: T;
    y: T;
    z: T;
  }

  export interface PosVel {
    position: EciVec3<number> | false;
    velocity: EciVec3<number> | false;
  }

  export interface LookAngles {
    azimuth: number;    // radians
    elevation: number;  // radians
    rangeSat: number;   // km
  }

  export interface GeodeticLocation {
    longitude: number;  // radians
    latitude: number;   // radians
    height: number;     // km
  }

  export function twoline2satrec(line1: string, line2: string): SatRec;
  export function propagate(satrec: SatRec, date: Date): PosVel;
  export function gstime(date: Date): number;
  export function eciToEcf(eci: EciVec3<number>, gmst: number): EciVec3<number>;
  export function ecfToLookAngles(
    observerGd: GeodeticLocation,
    ecf: EciVec3<number>
  ): LookAngles;
  export function degreesToRadians(deg: number): number;
  export function radiansToDegrees(rad: number): number;
}
