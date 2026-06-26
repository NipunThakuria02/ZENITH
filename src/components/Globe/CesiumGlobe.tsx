'use client';

// src/components/Globe/CesiumGlobe.tsx
// CRITICAL: CesiumJS accesses window/document on module load.
// NEVER use top-level static imports for CesiumJS in Next.js.
// All Cesium imports MUST happen inside useEffect via dynamic import().

import { useEffect, useRef } from 'react';

// Set CESIUM_BASE_URL before any Cesium import — must be at module scope
// but guarded by the window check so SSR doesn't break.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).CESIUM_BASE_URL = '/cesium';
}

interface ObserverPoint {
  lat: number;
  lng: number;
  name?: string;
}

interface Props {
  selected?: ObserverPoint;
  onLocationSelect?: (location: ObserverPoint) => void;
}

export default function CesiumGlobe({ selected, onLocationSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);

  // Keep a stable ref to the callback so the viewer init doesn't re-run on every render
  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  // ── Primary effect: initialise Cesium viewer (runs once, client-side only) ──
  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;

    (async () => {
      const Cesium = await import('cesium');
      // @ts-ignore
      await import('cesium/Build/Cesium/Widgets/widgets.css');

      if (destroyed || !containerRef.current) return;

      // Set Ion token from env — required for Bing world imagery
      Cesium.Ion.defaultAccessToken =
        process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN ?? '';

      const viewer = new Cesium.Viewer(containerRef.current!, {
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        timeline: false,
        navigationHelpButton: false,
        vrButton: false,
        fullscreenButton: false,
        shouldAnimate: true,
        scene3DOnly: true,
        skyBox: false,
        skyAtmosphere: false,
      });

      viewer.scene.globe.enableLighting = true;

      // Hide Cesium credit banner
      (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = 'none';

      // ── Click handler: pick lat/lng from globe surface ─────────────────────
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
      handler.setInputAction((click: any) => {
        const ray = viewer.camera.getPickRay(click.position);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!cartesian) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);

        console.log('[Zenith] Clicked:', latitude.toFixed(5), longitude.toFixed(5));

        onLocationSelectRef.current?.({
          lat: Number(latitude.toFixed(5)),
          lng: Number(longitude.toFixed(5)),
          name: `Lat ${latitude.toFixed(2)} Lon ${longitude.toFixed(2)}`,
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = { viewer, handler };
    })();

    return () => {
      destroyed = true;
      if (viewerRef.current) {
        viewerRef.current.handler?.destroy();
        viewerRef.current.viewer?.destroy();
        viewerRef.current = null;
      }
    };
  }, []); // empty deps: viewer is created once

  // ── Secondary effect: fly camera + place a labeled pin when `selected` changes ──
  useEffect(() => {
    if (!selected || !viewerRef.current?.viewer) return;

    (async () => {
      const Cesium = await import('cesium');
      const { viewer } = viewerRef.current!;

      // ── Remove previous marker ──
      viewer.entities.removeById('selected-pin');

      // ── Add new point + label entity ──
      const position = Cesium.Cartesian3.fromDegrees(selected.lng, selected.lat);

      // Standard red map-pin using Cesium's built-in PinBuilder
      const pinBuilder = new Cesium.PinBuilder();
      const pinCanvas  = pinBuilder.fromColor(Cesium.Color.fromCssColorString('#e53935'), 48);

      viewer.entities.add({
        id: 'selected-pin',
        position,

        // Red teardrop pin billboard
        billboard: {
          image:              pinCanvas,
          verticalOrigin:     Cesium.VerticalOrigin.BOTTOM,
          heightReference:    Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scale:              1.1,
        },

        // Location name label
        label: {
          text:               selected.name ?? `${selected.lat.toFixed(2)}°, ${selected.lng.toFixed(2)}°`,
          font:               '600 14px "Inter", sans-serif',
          fillColor:          Cesium.Color.WHITE,
          outlineColor:       Cesium.Color.fromCssColorString('#000814'),
          outlineWidth:       3,
          style:              Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset:        new Cesium.Cartesian2(18, -2),
          horizontalOrigin:   Cesium.HorizontalOrigin.LEFT,
          verticalOrigin:     Cesium.VerticalOrigin.CENTER,
          heightReference:    Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground:     true,
          backgroundColor:    Cesium.Color.fromCssColorString('#000814').withAlpha(0.75),
          backgroundPadding:  new Cesium.Cartesian2(8, 5),
        },
      });

      // ── Fly camera to location ──
      const destination = Cesium.Cartesian3.fromDegrees(
        selected.lng, selected.lat, 12_000_000
      );
      viewer.camera.flyTo({ destination, duration: 1.2 });
    })();
  }, [selected]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
