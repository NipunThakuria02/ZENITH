'use client';

import React from 'react';
import type { SatelliteResult } from '@/types';

interface Props {
  sat: SatelliteResult;
  altitudeKm: number;
  orbitClass: string;
  onClose: () => void;
}

export default function SatelliteInfoCard({ sat, altitudeKm, orbitClass, onClose }: Props) {
  // Category configuration
  const getCategoryConfig = (category: SatelliteResult['category']) => {
    switch (category) {
      case 'ISS':
        return {
          label: 'Space Station',
          bg: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          text: '#4ade80',
        };
      case 'starlink':
        return {
          label: 'Starlink',
          bg: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          text: '#60a5fa',
        };
      case 'debris':
        return {
          label: 'Debris',
          bg: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          text: '#fb7185',
        };
      case 'rocket':
        return {
          label: 'Rocket Body',
          bg: 'rgba(249, 115, 22, 0.12)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          text: '#fb923c',
        };
      case 'active':
      default:
        return {
          label: 'Active Satellite',
          bg: 'rgba(0, 212, 255, 0.12)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          text: '#00d4ff',
        };
    }
  };

  const badge = getCategoryConfig(sat.category);

  return (
    <div
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        width: '280px',
        background: 'rgba(10, 10, 24, 0.95)',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        borderRadius: '1rem',
        padding: '1rem',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 212, 255, 0.05)',
        color: '#e0e8ff',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        fontFamily: 'monospace',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#ffffff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '190px',
          }}
          title={sat.name}
        >
          {sat.name}
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#8fa0ba',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: '0.1rem 0.3rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8fa0ba')}
        >
          ✕
        </button>
      </div>

      {/* Category Badge */}
      <div style={{ display: 'flex' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.2rem 0.5rem',
            borderRadius: '0.35rem',
            background: badge.bg,
            border: badge.border,
            color: badge.text,
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(0, 212, 255, 0.1)', paddingTop: '0.6rem' }}>
        <InfoRow label="Orbit Class" value={orbitClass} />
        <InfoRow label="Altitude" value={`${altitudeKm.toLocaleString()} km`} />
        <InfoRow label="Slant Range" value={`${sat.range.toFixed(0)} km`} />
        <InfoRow label="Azimuth" value={`${sat.azimuth.toFixed(1)}°`} />
        <InfoRow label="Elevation" value={`${sat.elevation.toFixed(1)}°`} />
        <InfoRow label="Period" value={`${sat.period.toFixed(2)} min`} />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem' }}>
      <span style={{ color: '#4a6080' }}>{label}:</span>
      <span style={{ color: '#00d4ff', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
