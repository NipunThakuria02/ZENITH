// next.config.mjs
// PRE-WRITTEN — Do not modify. This solves the CesiumJS + Next.js SSR incompatibility.
// CesiumJS requires webpack to copy its static assets (Workers, Assets, ThirdParty, Widgets)
// into the public directory so they can be served at runtime.

import CopyPlugin from 'copy-webpack-plugin';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const cesiumSource = path.resolve(
        __dirname,
        'node_modules/cesium/Build/Cesium'
      );
      const cesiumPublic = path.resolve(__dirname, 'public/cesium');

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(cesiumSource, 'Workers'),
              to: path.join(cesiumPublic, 'Workers'),
            },
            {
              from: path.join(cesiumSource, 'ThirdParty'),
              to: path.join(cesiumPublic, 'ThirdParty'),
            },
            {
              from: path.join(cesiumSource, 'Assets'),
              to: path.join(cesiumPublic, 'Assets'),
            },
            {
              from: path.join(cesiumSource, 'Widgets'),
              to: path.join(cesiumPublic, 'Widgets'),
            },
          ],
        })
      );
    }

    // Prevent Node.js built-ins from being bundled into the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };




    return config;
  },

  // Suppress ESM warnings from CesiumJS
  experimental: {
    esmExternals: 'loose',
  },

  // Required for CesiumJS asset URLs
  async headers() {
    return [
      {
        source: '/cesium/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
