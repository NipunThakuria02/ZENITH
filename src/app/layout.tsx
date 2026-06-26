import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zenith — The Celestial Eye',
  description:
    'Project Zenith: real-time orbital congestion and sky observability. Pick your location, see what is above you.',
  keywords: ['satellites', 'orbital', 'sky', 'astronomy', 'cesium', 'real-time'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
        Google Fonts preconnect must live in <head>.
        The @import in globals.css handles the actual fetch,
        these preconnects just speed it up.
      */}
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
