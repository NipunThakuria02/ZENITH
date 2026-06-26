// src/types/index.ts
// LOCKED CONTRACT — All three modules import from here. Do not redefine these
// shapes locally in your own components. If you need a new field, add it here
// and notify the team — do not fork the type.

/** The user's selected viewing location. Saved to localStorage under
 *  key 'zenith_observer' by Person 1's location selection page. Read by
 *  Person 2's SkyDome and Person 3's Dashboard/Observability components. */
export interface Observer {
  lat: number;   // degrees, -90 to 90
  lng: number;   // degrees, -180 to 180
  alt: number;   // kilometers above sea level — default 0.05 if unknown
  name: string;  // display name, e.g. "Chennai, India"
}

/** Output of the satellite Web Worker (src/workers/satellite.worker.ts).
 *  Produced by Person 2's SatelliteLayer, consumed by Person 1's integration
 *  page (for the zenith count) and Person 3's CongestionWidget/GrowthChart. */
export interface SatelliteResult {
  name: string;
  azimuth: number;    // degrees, 0=North clockwise
  elevation: number;  // degrees above horizon
  range: number;       // km
  category: 'ISS' | 'starlink' | 'active' | 'debris' | 'rocket';
  period: number;      // orbital period in minutes
}

/** Aggregated counts derived from SatelliteResult[], passed from Person 2's
 *  SkyDome up to Person 1's page, then down into Person 3's Dashboard. */
export interface CongestionSummary {
  totalInZenithCone: number;
  active: number;
  debris: number;
  percentChangeSince2019: number;
}

/** Output of getPlanetPositions() in astronomy.ts. */
export interface PlanetPosition {
  name: string;
  azimuth: number;
  elevation: number;
  magnitude: number;
}

/** Output of calculateObservability() in observability.ts. Person 3 owns
 *  the calculation, Person 1's integration page may display a summary. */
export interface ObservabilityResult {
  score: number;
  rating: 'Excellent' | 'Good' | 'Moderate' | 'Poor';
  cloudCoverPercent: number;
  bortleScale: number;
  bortleLabel: string;
  moonPercent: number;
  bestWindow: string;
}

/** A single year's entry in the historical congestion dataset.
 *  Matches src/data/satcat-historical.json exactly. */
export interface HistoricalDataPoint {
  year: number;
  total: number;
  active: number;
  label: string;
}
