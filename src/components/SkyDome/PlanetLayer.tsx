'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { azElToVector3 } from '@/lib/coordinates';
import { getPlanetPositions } from '@/lib/astronomy';
import type { Observer } from '@/types';

interface Props {
  scene: THREE.Scene;
  observer: Observer;
  visible?: boolean;
}

const PLANET_COLORS: Record<string, number> = {
  Mercury: 0xb5b5b5, // grey/silver
  Venus: 0xffffc0, // pale yellow
  Mars: 0xff6644, // reddish-orange
  Jupiter: 0xffd4aa, // light brown/orange
  Saturn: 0xffe4a0, // pale sand/gold
};

export default function PlanetLayer({ scene, observer, visible }: Props) {
  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.visible = visible !== false;
    }
  }, [visible]);
  useEffect(() => {
    const group = new THREE.Group();
    group.name = 'planet-layer';
    group.visible = visible !== false;
    groupRef.current = group;
    scene.add(group);

    const now = new Date();
    const planets = getPlanetPositions(observer, now);

    planets.forEach((planet) => {
      const position = azElToVector3(planet.azimuth, planet.elevation, 460); // slightly closer so they are larger/clearer

      // Make planets significantly larger so they are clearly visible
      // Venus/Jupiter will be around 12-14 units, Saturn ~10 units, Mars ~8 units
      const size = Math.max(7, 12 - planet.magnitude * 2);

      // 1. Planet sphere
      const color = PLANET_COLORS[planet.name] ?? 0xffffff;
      const sphereGeo = new THREE.SphereGeometry(size, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.position.copy(position);
      mesh.renderOrder = 20; // Draw on top of stars
      group.add(mesh);

      // 2. Ring for Saturn
      if (planet.name === 'Saturn') {
        const ringGeo = new THREE.RingGeometry(size * 1.4, size * 2.6, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffe4a0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          depthTest: false,
          depthWrite: false,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(position);
        ringMesh.lookAt(new THREE.Vector3(0, 0, 0));
        ringMesh.rotateX(Math.PI / 3.2);
        ringMesh.renderOrder = 21;
        group.add(ringMesh);
      }

      // 3. Canvas-based text label sprite
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createLabelTexture(planet.name),
          depthTest: false,
          depthWrite: false,
          transparent: true,
        })
      );
      // Scale matches the 512x96 texture aspect ratio (~5.3:1)
      label.scale.set(90, 17, 1);
      const offsetPos = position.clone().multiplyScalar(1.06); // offset further outwards
      label.position.copy(offsetPos);
      label.renderOrder = 22; // Draw label on top of planet/ring
      group.add(label);
    });

    return () => {
      scene.remove(group);
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        if (child instanceof THREE.Sprite) {
          child.material.dispose();
        }
      });
    };
  }, [scene, observer]);

  return null;
}

function createLabelTexture(text: string) {
  const W = 512, H = 96;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const R = 18; // corner radius

  // ── Background pill ──
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(W - R, 0);
  ctx.quadraticCurveTo(W, 0, W, R);
  ctx.lineTo(W, H - R);
  ctx.quadraticCurveTo(W, H, W - R, H);
  ctx.lineTo(R, H);
  ctx.quadraticCurveTo(0, H, 0, H - R);
  ctx.lineTo(0, R);
  ctx.quadraticCurveTo(0, 0, R, 0);
  ctx.closePath();

  // Dark navy fill
  ctx.fillStyle = 'rgba(2, 8, 24, 0.92)';
  ctx.fill();

  // Cyan glowing border
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth   = 5;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur  = 12;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // ── Planet name text ──
  ctx.font         = 'bold 40px "Inter", "Segoe UI", sans-serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Drop-shadow for depth
  ctx.shadowColor  = '#000000';
  ctx.shadowBlur   = 8;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = '#ffffff';
  ctx.fillText(text.toUpperCase(), W / 2, H / 2 - 2);

  // Subtle cyan highlight underneath
  ctx.shadowBlur   = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle     = 'rgba(0,212,255,0.18)';
  ctx.fillText(text.toUpperCase(), W / 2, H / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
