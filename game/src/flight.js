// flight.js — the flight model: throttle, pitch, bank, turn coordination,
// stall, fuel burn and terrain/runway contact. Arcade-tuned, but every
// control answers at every speed and a landing reads as a landing.
import { CONFIG } from './config.js';
import { RUNWAY, isOnRunway, terrainHeight } from './terrain.js';

export function createFlight(start) {
  return {
    x: start.x,
    y: start.y,
    z: start.z,
    heading: start.heading,
    pitch: 0,
    roll: 0,
    speed: start.speed,
    throttle: start.throttle,
    fuel: CONFIG.fuelStart,
    damage: 0,
    verticalSpeed: 0,
    grounded: false,
    landed: false,
    crashed: false,
    crashReason: '',
    stalled: false,
    gearDown: true,
    flaps: false,
    time: 0,
  };
}

// One fixed step of the flight model. `stick` is {pitch:-1..1, roll:-1..1,
// throttle:-1..1 (change), brake:boolean}. Returns events for the game.
export function stepFlight(plane, stick, dt) {
  const events = [];
  if (plane.crashed || plane.landed) return events;
  plane.time += dt;

  // Throttle: stick up/down, clamped 0..1. Empty tank means no thrust.
  const targetThrottle = plane.fuel > 0 ? plane.throttle + stick.throttle * CONFIG.throttleAccel * dt : 0;
  plane.throttle = Math.max(0, Math.min(1, targetThrottle));
  if (stick.brake) plane.throttle = Math.max(0, plane.throttle - dt * 1.4);

  // Speed chases throttle; drag grows with flaps and with the gear down low.
  let targetSpeed = plane.throttle * CONFIG.maxSpeed;
  if (plane.flaps) targetSpeed *= 0.82;
  plane.speed += (targetSpeed - plane.speed) * Math.min(1, CONFIG.speedResponse * dt);
  if (plane.speed < CONFIG.minSpeed) plane.speed = CONFIG.minSpeed;

  // Stall: too slow and the nose drops, the wing sinks.
  plane.stalled = plane.speed < CONFIG.stallSpeed && plane.y > terrainHeight(plane.x, plane.z) + 6;
  const pitchInput = plane.stalled ? stick.pitch * 0.4 - 0.35 : stick.pitch;
  plane.pitch += pitchInput * CONFIG.pitchRate * dt;
  plane.pitch = Math.max(-CONFIG.maxPitch, Math.min(CONFIG.maxPitch, plane.pitch));
  plane.roll += stick.roll * CONFIG.rollRate * dt;
  plane.roll = Math.max(-CONFIG.maxRoll, Math.min(CONFIG.maxRoll, plane.roll));
  // Gentle auto-level when the stick is centred, so the camera never fights.
  if (Math.abs(stick.roll) < 0.05) plane.roll *= Math.max(0, 1 - 0.7 * dt);
  if (Math.abs(stick.pitch) < 0.05) plane.pitch *= Math.max(0, 1 - 0.5 * dt);

  // Banked turn: heading follows the bank, more at higher speed.
  plane.heading += -plane.roll * CONFIG.turnFactor * (plane.speed / CONFIG.cruiseSpeed) * dt;

  // Velocity along the nose, plus a stall sink.
  const cosPitch = Math.cos(plane.pitch);
  const vx = Math.sin(plane.heading) * cosPitch * plane.speed;
  const vz = Math.cos(plane.heading) * cosPitch * plane.speed;
  let vy = Math.sin(plane.pitch) * plane.speed;
  if (plane.stalled) vy -= CONFIG.gravitySink;
  plane.verticalSpeed = vy;
  plane.x += vx * dt;
  plane.z += vz * dt;
  plane.y += vy * dt;

  // Soft world edge: the sea stretches on, so turn the pilot back toward
  // the islands, firmly enough that holding the stick cannot escape it.
  const edge = 1750;
  if (Math.abs(plane.x) > edge || Math.abs(plane.z) > edge) {
    events.push({ type: 'edge' });
    const home = Math.atan2(-plane.x, -plane.z);
    let turn = home - plane.heading;
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    plane.heading += Math.max(-1.5 * dt, Math.min(1.5 * dt, turn));
  }

  // Fuel burn scales with throttle.
  plane.fuel = Math.max(0, plane.fuel - CONFIG.fuelBurnPerSecond * (0.25 + plane.throttle) * dt);
  if (plane.fuel <= 0 && !plane.fuelWarned) {
    plane.fuelWarned = true;
    events.push({ type: 'fuel-empty' });
  }

  // Ground contact.
  const ground = terrainHeight(plane.x, plane.z);
  const onStrip = isOnRunway(plane.x, plane.z);
  if (plane.y <= ground + 2.5) {
    plane.y = ground + 2.5;
    if (onStrip && Math.abs(plane.z - RUNWAY.zCentre) <= RUNWAY.halfWidth) {
      landOnRunway(plane, events);
    } else if (ground < 0) {
      crashPlane(plane, events, 'Ditched in the sea — the Kestrel is not a boat.');
    } else if (Math.abs(plane.verticalSpeed) <= 4.5 && plane.speed <= 55) {
      // A gentle touchdown on grass is a rough-field landing, not a
      // crash: the plane stops, damaged, short of the runway.
      plane.landed = true;
      plane.offRunway = true;
      plane.grounded = true;
      plane.damage = Math.min(100, plane.damage + 40);
      plane.crashReason = 'Put it down in the grass beside the runway — the mission needs the strip.';
      plane.pitch = 0;
      plane.roll = 0;
      plane.speed = Math.max(0, plane.speed - 30);
      events.push({ type: 'landed', aligned: false, soft: true, slow: true, offRunway: true });
    } else {
      crashPlane(plane, events, 'Clipped the terrain — watch the hills, pilot.');
    }
  }
  return events;
}

function landOnRunway(plane, events) {
  const aligned = Math.abs(Math.sin(plane.heading - RUNWAY.headingEast)) < 0.45
    || Math.abs(Math.sin(plane.heading + RUNWAY.headingEast)) < 0.45;
  const soft = Math.abs(plane.verticalSpeed) <= CONFIG.hardLandingVerticalSpeed;
  const slow = plane.speed <= 72;
  if (!soft || !slow) {
    if (!soft) plane.damage += 35;
    if (!slow) plane.damage += 25;
    if (plane.damage >= 100) {
      crashPlane(plane, events, 'Came in too hot — the landing gear gave up.');
      return;
    }
    events.push({ type: 'hard-landing', damage: plane.damage });
  }
  plane.landed = true;
  plane.grounded = true;
  plane.pitch = 0;
  plane.roll = 0;
  plane.speed = Math.max(0, plane.speed - 30);
  events.push({ type: 'landed', aligned, soft, slow });
}

function crashPlane(plane, events, reason) {
  plane.crashed = true;
  plane.crashReason = reason;
  plane.speed = 0;
  events.push({ type: 'crashed', reason });
}

// Readouts for the HUD, in pilot units.
export function readInstruments(plane) {
  return {
    altitudeFt: Math.max(0, Math.round(plane.y * 3.28084)),
    speedKt: Math.round(plane.speed * 1.94384),
    headingDeg: Math.round(((plane.heading * 180) / Math.PI % 360 + 360) % 360),
    verticalSpeedFpm: Math.round(plane.verticalSpeed * 196.85),
    fuelPct: Math.round(plane.fuel),
    throttlePct: Math.round(plane.throttle * 100),
  };
}
