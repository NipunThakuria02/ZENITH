import * as Astronomy from 'astronomy-engine';
import type { Observer, PlanetPosition } from '@/types';

export function getPlanetPositions(observer: Observer, date: Date = new Date()): PlanetPosition[] {
  // Astronomy.Observer takes latitude, longitude, and height (in meters).
  // observer.alt is in kilometers, so we multiply by 1000 to get meters.
  const heightMeters = (observer.alt ?? 0.05) * 1000;
  const astObserver = new Astronomy.Observer(observer.lat, observer.lng, heightMeters);

  const bodies = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as Astronomy.Body[];

  return bodies
    .map((body) => {
      const equ = Astronomy.Equator(body, date, astObserver, true, true);
      const hor = Astronomy.Horizon(date, astObserver, equ.ra, equ.dec, 'normal');
      const illum = Astronomy.Illumination(body, date);
      return {
        name: String(body),
        azimuth: hor.azimuth,
        elevation: hor.altitude,
        magnitude: illum.mag,
      };
    })
    .filter((planet) => planet.elevation > 0);
}
