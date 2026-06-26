import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '../public/tle_fallback.txt');

function calculateChecksum(line) {
  let sum = 0;
  for (let i = 0; i < 68; i++) {
    const char = line[i];
    if (char >= '0' && char <= '9') {
      sum += parseInt(char);
    } else if (char === '-') {
      sum += 1;
    }
  }
  return sum % 10;
}

function formatLine1(catalogNo, designator, epoch) {
  const lineWithoutChecksum = `1 ${catalogNo.toString().padStart(5, '0')}U ${designator.padEnd(8, ' ')} ${epoch.padEnd(14, ' ')}  .00001234  00000-0  12345-3 0  999`;
  const checksum = calculateChecksum(lineWithoutChecksum);
  return lineWithoutChecksum + checksum;
}

function formatLine2(catalogNo, inclination, raan, eccentricity, argPerigee, meanAnomaly, meanMotion, revNo) {
  const incStr = inclination.toFixed(4).padStart(8, ' ');
  const raanStr = raan.toFixed(4).padStart(8, ' ');
  const eccStr = Math.round(eccentricity * 10000000).toString().padStart(7, '0');
  const argPStr = argPerigee.toFixed(4).padStart(8, ' ');
  const maStr = meanAnomaly.toFixed(4).padStart(8, ' ');
  const mmStr = meanMotion.toFixed(8).padStart(11, ' ');
  const revStr = revNo.toString().padStart(5, '0');

  const lineWithoutChecksum = `2 ${catalogNo.toString().padStart(5, '0')} ${incStr} ${raanStr} ${eccStr} ${argPStr} ${maStr} ${mmStr}${revStr}`;
  const checksum = calculateChecksum(lineWithoutChecksum);
  return lineWithoutChecksum + checksum;
}

function main() {
  const tles = [];

  // Epoch around current year 2026
  const epoch = '26175.12345678';

  // 1. ISS (ZARYA)
  tles.push('ISS (ZARYA)');
  tles.push(formatLine1(25544, '98067A', epoch));
  tles.push(formatLine2(25544, 51.6468, 123.4567, 0.0004427, 224.4953, 135.5681, 15.49396189, 57283));

  // 2. HST (Hubble Space Telescope)
  tles.push('HST');
  tles.push(formatLine1(20580, '90037B', epoch));
  tles.push(formatLine2(20580, 28.4728, 27.4055, 0.0001442, 233.5980, 126.4483, 15.30829347, 99999));

  // 3. CSS (TIANHE-1)
  tles.push('CSS (TIANHE-1)');
  tles.push(formatLine1(48274, '21035A', epoch));
  tles.push(formatLine2(48274, 41.4689, 278.8848, 0.0007696, 138.8892, 221.2528, 15.61092232, 29427));

  // 4. Generate 40 Starlink satellites distributed in orbital shells
  for (let i = 1; i <= 40; i++) {
    const catalogNo = 50000 + i;
    const designator = `23${(20 + Math.floor(i / 10)).toString()}A`;
    // Distribute RAAN (0 to 360 deg) and mean anomaly (0 to 360 deg)
    const raan = (i * 9) % 360;
    const meanAnomaly = (i * 17) % 360;
    const argP = (i * 23) % 360;
    const inc = 53.0; // Starlink shell inclination
    const eccentricity = 0.0001 + (i * 0.00001);
    const meanMotion = 15.02 + (i * 0.001); // LEO orbit ~95 minutes
    
    tles.push(`STARLINK-${30000 + i}`);
    tles.push(formatLine1(catalogNo, designator, epoch));
    tles.push(formatLine2(catalogNo, inc, raan, eccentricity, argP, meanAnomaly, meanMotion, i * 100));
  }

  // 5. Generate 15 Debris objects (DEB)
  for (let i = 1; i <= 15; i++) {
    const catalogNo = 90000 + i;
    const designator = `09012${String.fromCharCode(65 + i)}`;
    const raan = (i * 24) % 360;
    const meanAnomaly = (i * 13) % 360;
    const argP = (i * 37) % 360;
    // Some polar, some inclined
    const inc = i % 2 === 0 ? 98.2 : 53.0;
    const eccentricity = 0.001 + (i * 0.0002);
    const meanMotion = 14.2 + (i * 0.05); // slightly higher orbit or different periods

    tles.push(`DEB (FENGYUN 1C) [${catalogNo}]`);
    tles.push(formatLine1(catalogNo, designator, epoch));
    tles.push(formatLine2(catalogNo, inc, raan, eccentricity, argP, meanAnomaly, meanMotion, i * 40));
  }

  // 6. Generate 15 Rocket Bodies (R/B)
  for (let i = 1; i <= 15; i++) {
    const catalogNo = 80000 + i;
    const designator = `12045${String.fromCharCode(65 + i)}`;
    const raan = (i * 19) % 360;
    const meanAnomaly = (i * 29) % 360;
    const argP = (i * 11) % 360;
    const inc = i % 3 === 0 ? 98.5 : (i % 3 === 1 ? 74.0 : 51.6);
    const eccentricity = 0.0005 + (i * 0.0001);
    const meanMotion = 14.5 + (i * 0.03);

    tles.push(`CZ-4B R/B [${catalogNo}]`);
    tles.push(formatLine1(catalogNo, designator, epoch));
    tles.push(formatLine2(catalogNo, inc, raan, eccentricity, argP, meanAnomaly, meanMotion, i * 25));
  }

  fs.writeFileSync(OUT_FILE, tles.join('\n') + '\n', 'utf8');
  console.log(`Successfully generated ${tles.length / 3} TLEs in ${OUT_FILE}`);
}

main();
