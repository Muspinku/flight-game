// terrain.js — the island archipelago: heightfield, runway, harbour city,
// clouds and the camera projection. Everything is generated from a fixed
// seed, so the world never changes between loads.
import { createRandom } from './random.js';

const rng = createRandom(20261126);

// Gaussian island bumps: {cx, cz, radius, height}.
const ISLANDS = [
  { cx: 0, cz: 950, radius: 720, height: 64 }, // main island, carries the runway
  { cx: -950, cz: -450, radius: 560, height: 195 }, // mountain island, snow peaks
  { cx: 950, cz: -750, radius: 470, height: 74 }, // green isle
  { cx: 620, cz: 420, radius: 210, height: 26 }, // harbour islet
  { cx: -620, cz: 1250, radius: 260, height: 38 }, // lighthouse rock
  { cx: 320, cz: -1450, radius: 310, height: 52 }, // north cape
  { cx: -1350, cz: 900, radius: 230, height: 30 },
  { cx: 1350, cz: 1150, radius: 240, height: 34 },
];

// Runway 09: flat strip on the main island, east-west, centre z = 1000.
export const RUNWAY = {
  xMin: -300,
  xMax: 300,
  zCentre: 1000,
  halfWidth: 20,
  height: 12,
  headingEast: Math.PI / 2,
};

function bumpHeight(x, z) {
  let h = 0;
  for (const island of ISLANDS) {
    const dx = (x - island.cx) / island.radius;
    const dz = (z - island.cz) / island.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < 4) h += island.height * Math.exp(-d2 * 1.6);
  }
  // Gentle rolling noise so flat land is not a billiard table.
  h += 5 * Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.013 - 0.6);
  h += 2.5 * Math.sin(x * 0.031) * Math.sin(z * 0.027 + 2.1);
  return h;
}

// Height of the ground (or sea floor, negative) at a world point.
export function terrainHeight(x, z) {
  const base = bumpHeight(x, z) - 14; // sea level sits 14 m above the bump base
  // Flatten a plateau for the runway and its apron.
  const dx = Math.max(RUNWAY.xMin - 90 - x, 0, x - (RUNWAY.xMax + 90));
  const dz = Math.abs(z - RUNWAY.zCentre) - 110;
  const outside = Math.max(dx, dz);
  if (outside <= 0) return RUNWAY.height;
  if (outside < 160) {
    const t = outside / 160;
    return RUNWAY.height * (1 - t) + base * t;
  }
  return base;
}

export function isOnRunway(x, z) {
  return x >= RUNWAY.xMin && x <= RUNWAY.xMax && Math.abs(z - RUNWAY.zCentre) <= RUNWAY.halfWidth;
}

export function isOverSea(x, z) {
  return terrainHeight(x, z) < 0;
}

// Harbour city: small boxes on the main island, south of the runway.
export const CITY = (() => {
  const boxes = [];
  const local = createRandom(77);
  for (let i = 0; i < 46; i += 1) {
    const x = -260 + local.range(0, 520);
    const z = 1180 + local.range(0, 260);
    const h = terrainHeight(x, z);
    if (h < 4) continue;
    const w = local.range(14, 30);
    const d = local.range(14, 30);
    boxes.push({
      x, z, y: h, w, d,
      height: local.range(10, 34),
      shade: local.pick(['#b8a88f', '#9fb3c2', '#c2b49a', '#8fa8b8', '#d8c9a8']),
    });
  }
  return boxes;
})();

// Puffy clouds drifting over the islands.
export const CLOUDS = (() => {
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: rng.range(-1700, 1700),
      y: rng.range(260, 400),
      z: rng.range(-1700, 1700),
      scale: rng.range(60, 150),
      puffs: 3 + Math.floor(rng.next() * 3),
    });
  }
  return clouds;
})();

// ---------------------------------------------------------------------------
// Camera projection: world point -> screen point, or null when behind camera.
// The camera looks along `forward` (unit vector) with `right` and `up` basis.
export function createProjector(camera, forward, focal, centreX, centreY) {
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  function project(p) {
    const dx = p[0] - camera[0];
    const dy = p[1] - camera[1];
    const dz = p[2] - camera[2];
    const cz = dx * forward[0] + dy * forward[1] + dz * forward[2];
    if (cz < 2) return null;
    const cx = dx * right[0] + dy * right[1] + dz * right[2];
    const cy = dx * up[0] + dy * up[1] + dz * up[2];
    return {
      x: centreX + (cx / cz) * focal,
      y: centreY - (cy / cz) * focal,
      depth: cz,
      scale: focal / cz,
    };
  }
  return { project, right, up };
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

// Colour of a terrain quad from its height: smooth bands (sand only in a
// thin beach strip) with a brightness jitter so the ground reads as
// varied land, not flat paint.
export function groundColour(height, variation) {
  const jitter = 0.96 + variation * 0.08;
  const mix = (a, b, t) => {
    const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    const out = ca.map((v, i) => Math.round((v + (cb[i] - v) * t) * jitter));
    return `rgb(${out[0]},${out[1]},${out[2]})`;
  };
  if (height < -2) return mix('#12557c', '#155e86', 0.5);
  if (height < 1.5) return mix('#2f8fb5', '#2a7fa3', 0.5);
  if (height < 2) return '#e2cd92';
  if (height < 4) return mix('#e2cd92', '#5da24a', Math.min(1, (height - 2) / 2));
  if (height < 60) return mix('#5da24a', '#6fae56', Math.min(1, (height - 14) / 46));
  if (height < 95) return mix('#6fae56', '#8a7a66', Math.min(1, (height - 60) / 35));
  if (height < 150) return mix('#8a7a66', '#a89a86', Math.min(1, (height - 95) / 55));
  return mix('#dfe7ec', '#eef2f5', 0.5);
}
