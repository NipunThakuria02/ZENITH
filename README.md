# Zenith — The Celestial Eye

Project Zenith is a real-time astronomical and space tracking application. It allows users to select a viewing location on a high-fidelity 3D Earth globe and immediately observe the sky dome directly above them, showing stars, constellations, planets, and live satellite orbits, alongside real-time space situational awareness (SSA) analytics.

---

##  Key Features & Website Functionality

* **3D Interactive Globe Location Selector:** Full-screen 3D globe (powered by CesiumJS) for choosing an observation point anywhere on Earth by clicking on the map.
* **Live Sky Dome Simulation:** A high-performance 3D rendering of the night sky directly above the observer (powered by Three.js), projecting stars (HYG Catalog), constellations, planets, and satellites in real-time.
* **Multithreaded Orbital Propagation:** Live Keplerian element sets (TLEs) propagated using a client-side Web Worker (SGP4 propagation via `satellite.js`) to ensure fluid 60FPS UI rendering without blocking the main browser thread.
* **Space Congestion Analysis:** Tracks and categorizes space objects currently overhead within the observer's horizon cone into Active Satellites, space Debris, Rocket Bodies, and the International Space Station (ISS).
* **Observability Score Engine:** Dynamically rates local stargazing conditions (Excellent, Good, Moderate, Poor) by analyzing light pollution index (Falchi Light Pollution Database), cloud cover percentage (OpenWeather API), and moon phase illumination (Astronomy Engine).
* **Interactive Filtering Bottom Bar:** Quick-toggle checkboxes allowing observers to filter stars, satellites, and constellations dynamically.
* **Advanced Analytics Drawer:** Slides open a detailed data dashboard showing regional footprint mapping, orbit classification (LEO/MEO/GEO), and historical congestion growth trends since 2019.
* **Offline Resiliency:** Automatic fallback to pre-cached TLE feeds and star catalogs when API endpoints fail or rate-limits are reached, complete with a visual warning vignette and a manual "Refresh & Reconnect" trigger.

---

##  Installation & Setup

### Prerequisites
Ensure you have **Node.js 18+** and **npm** installed on your system.

### Steps
1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy the example environment file to create your local configurations:
   ```bash
   cp .env.local.example .env.local
   ```
   Open `.env.local` and add your API keys (optional but recommended for live data):
   * `NEXT_PUBLIC_CESIUM_ION_TOKEN` — Cesium Ion token for high-quality Bing imagery.
   * `OPENWEATHER_API_KEY` — OpenWeather token for live cloud coverage updates.
   * `N2YO_API_KEY` — N2YO API key for live real-time satellite TLE updates.

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 📦 Dependencies & Libraries

### Framework & Core
* **Next.js 14 (App Router):** Production-ready React framework.
* **React 18:** Declarative user interface library.
* **TypeScript:** Static type checking for robust code organization.
* **TailwindCSS:** Responsive styling utility framework.

### Astronomical & Graphical Math
* **Three.js:** Renders the interactive 3D Sky Dome, stars, and satellites.
* **CesiumJS:** Renders the 3D Earth Globe for location selection.
* **astronomy-engine:** Calculates planetary coordinate positions and moon illumination metrics.
* **satellite.js:** Computes real-time SGP4 orbital propagation of satellites from TLE Keplerian element data.
* **PapaParse:** Lightweight parser for processing CSV data streams.
* **Recharts:** Responsive SVG graphs for displaying historical trends.

---

## 🚀 Hosting on Vercel

1. Push your clean codebase to a GitHub repository.
2. Link the repository to your [Vercel Dashboard](https://vercel.com).
3. Add the environment variables (`NEXT_PUBLIC_CESIUM_ION_TOKEN`, `OPENWEATHER_API_KEY`, etc.) inside the Vercel project settings.
4. Deploy. The generated assets inside `public/cesium/` are automatically built and packaged on Vercel's servers.
