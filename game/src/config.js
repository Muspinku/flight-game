// config.js — one place for every tunable number of Kestrel: Island Run.
// A small original prop-plane flight game: fly rings over an island archipelago,
// then land on runway 09. No real-world names, no copied art or levels.
export const CONFIG = {
  // World: metres. Sea level is y = 0, north is +z, heading 0 flies north.
  worldHalfSize: 1800,
  terrainStep: 90,
  seaLevel: 0,
  // Flight model.
  maxSpeed: 96, // m/s at full throttle
  cruiseSpeed: 62,
  stallSpeed: 27, // below this the nose drops
  minSpeed: 12,
  throttleAccel: 0.55, // per second toward the target throttle
  speedResponse: 0.35, // per second toward throttle * maxSpeed
  pitchRate: 0.85, // rad/s at full stick
  rollRate: 1.9, // rad/s at full stick
  maxPitch: 0.55,
  maxRoll: 1.25,
  turnFactor: 0.75, // heading rate per radian of bank, scaled by speed
  gravitySink: 9, // m/s of sink when stalled
  fuelBurnPerSecond: 0.16, // at full throttle; scaled by throttle
  fuelStart: 100,
  // Camera.
  chaseDistance: 17,
  chaseHeight: 4.6,
  focalLength: 760,
  // Rings and scoring.
  ringRadius: 30,
  ringPoints: 250,
  landingPoints: 1000,
  checkpointPoints: 200,
  // Damage.
  crashVerticalSpeed: 9, // |vy| above this on impact is a crash
  hardLandingVerticalSpeed: 5.5, // above this on the runway costs damage
};

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    blurb: 'Thread 8 sky rings over the islands, then land on runway 09.',
    start: { x: 0, y: 150, z: -1250, heading: 0, speed: 58, throttle: 0.7 },
  },
  {
    id: 'island-tour',
    name: 'Island Tour',
    blurb: 'Visit 5 beacons — mountain peak, green isle, harbour, lighthouse rock, north cape — then land.',
    start: { x: -500, y: 170, z: -1250, heading: 0.35, speed: 58, throttle: 0.7 },
  },
  {
    id: 'landing-challenge',
    name: 'Landing Challenge',
    blurb: 'Short final: line up, bleed speed, grease it on the centreline.',
    start: { x: -1150, y: 95, z: 1000, heading: Math.PI / 2, speed: 46, throttle: 0.42 },
  },
];

export const PALETTE = {
  skyTop: '#2e6db0',
  skyMid: '#7fb6dd',
  horizon: '#d8ecf6',
  seaDeep: '#155e86',
  seaShallow: '#2f8fb5',
  sand: '#e2cd92',
  grass: '#5da24a',
  grassDark: '#4a8f3e',
  rock: '#8a7a66',
  snow: '#eef2f5',
  runway: '#3c4148',
  runwayMark: '#f4f6f2',
  planeCream: '#f2ead8',
  planeTeal: '#0f766e',
  planeOrange: '#e8622c',
  ringNext: '#ffc53d',
  ringDone: '#3ecf6e',
  ringLater: '#e8f2f8',
};
