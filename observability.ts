import * as Astronomy from 'astronomy-engine';
import { haversineDistance } from '@/lib/coordinates';
import type { Observer, ObservabilityResult } from '@/types';
import falchiLookup from '@/data/falchi-lookup.json';

export async function calculateObservability(observer: Observer): Promise<ObservabilityResult> {
  let cloudCoverPercent = 25; // default fallback
  let description = 'clear sky';

  try {
    // Fetch from weather proxy API
    const res = await fetch(`/api/weather?lat=${observer.lat}&lng=${observer.lng}`);
    if (res.ok) {
      const data = await res.json();
      cloudCoverPercent = data.cloudCoverPercent ?? 0;
      description = data.description ?? 'clear sky';
    }
  } catch (err) {
    console.warn('[Observability] Weather fetch failed, using default:', err);
  }

  // Find nearest Falchi entry
  const nearest = findNearestFalchi(observer.lat, observer.lng);
  const bortleScale = nearest.bortle;
  const bortleLabel = nearest.label;

  // Calculate moon illumination
  const date = new Date();
  const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const moonFraction = moonIllum.phase_fraction; // fraction from 0 to 1
  const moonPercent = Math.round(moonFraction * 100);

  // Score formula: Math.round((1 - cloudCover) * 50 + lightInv * 30 + moonDark * 20)
  const cloudCover = cloudCoverPercent / 100;
  const lightInv = 1 - (bortleScale / 9);
  const moonDark = 1 - moonFraction;

  const score = Math.max(0, Math.min(100, Math.round(
    (1 - cloudCover) * 50 +
    lightInv * 30 +
    moonDark * 20
  )));

  const rating = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Moderate' : 'Poor';

  // Format a best window dynamically based on description/conditions
  const bestWindow = score >= 65 ? '20:00–23:30 Local' : '02:00–04:30 Local';

  return {
    score,
    rating,
    cloudCoverPercent,
    bortleScale,
    bortleLabel,
    moonPercent,
    bestWindow,
  };
}

function findNearestFalchi(lat: number, lng: number) {
  let best = falchiLookup[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const item of falchiLookup) {
    // Note: falchi-lookup.json uses "lon" instead of "lng"
    const distance = haversineDistance(lat, lng, item.lat, item.lon);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = item;
    }
  }

  return best;
}
