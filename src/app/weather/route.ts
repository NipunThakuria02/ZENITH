import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Missing lat or lng' }, { status: 400 });
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    // Return mock fallback data if OpenWeather key is not configured
    return NextResponse.json({
      cloudCoverPercent: 24,
      description: 'scattered clouds (fallback)',
    });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`OpenWeather HTTP error ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({
      cloudCoverPercent: data.clouds?.all ?? 0,
      description: data.weather?.[0]?.description ?? 'clear sky',
    });
  } catch (err) {
    console.warn('[Weather API Proxy] Failed, returning mock data:', err);
    return NextResponse.json({
      cloudCoverPercent: 18,
      description: 'few clouds (fallback on error)',
    });
  }
}
