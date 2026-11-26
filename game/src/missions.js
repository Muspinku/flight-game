// missions.js — the three sorties: where the rings and beacons sit, what
// counts as passing one, and how the score is built. Ring Run is the
// default; every mission ends with a landing on runway 09.
import { CONFIG } from './config.js';

const RING_COURSE = [
  { x: 0, y: 115, z: -800 },
  { x: 350, y: 135, z: -300 },
  { x: 520, y: 125, z: 300 },
  { x: 220, y: 150, z: 820 },
  { x: -320, y: 140, z: 1120 },
  { x: -720, y: 165, z: 620 },
  { x: -620, y: 130, z: -120 },
  { x: -220, y: 115, z: -620 },
];

const TOUR_BEACONS = [
  { x: -950, y: 260, z: -450, label: 'Mountain Peak' },
  { x: 950, y: 150, z: -750, label: 'Green Isle' },
  { x: 620, y: 110, z: 420, label: 'Harbour' },
  { x: -620, y: 120, z: 1250, label: 'Lighthouse Rock' },
  { x: 320, y: 130, z: -1450, label: 'North Cape' },
];

export function createMission(missionId) {
  const base = {
    id: missionId,
    rings: [],
    beacons: [],
    nextIndex: 0,
    ringsPassed: 0,
    score: 0,
    done: false,
    phase: 'fly', // fly -> land -> complete
    message: '',
    messageUntil: 0,
  };
  if (missionId === 'ring-run') {
    base.rings = RING_COURSE.map((p) => ({ ...p, passed: false }));
    base.objective = 'Fly through the rings, then land on runway 09.';
  } else if (missionId === 'island-tour') {
    base.beacons = TOUR_BEACONS.map((p) => ({ ...p, passed: false }));
    base.objective = 'Visit all 5 beacons, then land on runway 09.';
  } else {
    base.objective = 'Land on runway 09 — soft, slow and on the centreline.';
    base.phase = 'land';
  }
  return base;
}

export function nextTarget(mission) {
  if (mission.phase === 'land') return { kind: 'runway', x: 0, y: 12, z: 1000, label: 'Runway 09' };
  const list = mission.rings.length ? mission.rings : mission.beacons;
  const target = list[mission.nextIndex];
  if (!target) return { kind: 'runway', x: 0, y: 12, z: 1000, label: 'Runway 09' };
  if (mission.rings.length) return { kind: 'ring', ...target, label: `Ring ${mission.nextIndex + 1}` };
  return { kind: 'beacon', ...target };
}

// Check the plane against the current target. Returns events.
export function updateMission(mission, plane, now) {
  const events = [];
  if (mission.phase === 'complete') return events;
  if (mission.phase === 'fly') {
    const list = mission.rings.length ? mission.rings : mission.beacons;
    const target = list[mission.nextIndex];
    if (target) {
      const dx = plane.x - target.x;
      const dy = plane.y - target.y;
      const dz = plane.z - target.z;
      const dist = Math.hypot(dx, dy, dz);
      const radius = mission.rings.length ? CONFIG.ringRadius : 55;
      if (dist < radius) {
        target.passed = true;
        mission.nextIndex += 1;
        mission.ringsPassed += 1;
        const points = mission.rings.length ? CONFIG.ringPoints : CONFIG.checkpointPoints;
        mission.score += points;
        events.push({ type: 'target', label: target.label || `Ring ${mission.nextIndex}`, points });
        if (mission.nextIndex >= list.length) {
          mission.phase = 'land';
          mission.message = 'Course complete — now land on runway 09!';
          mission.messageUntil = now + 4;
        }
      }
    }
  }
  if (plane.landed && mission.phase !== 'complete') {
    if (plane.offRunway) {
      mission.phase = 'complete';
      mission.done = true;
      events.push({ type: 'mission-failed', reason: plane.crashReason });
      return events;
    }
    mission.phase = 'complete';
    mission.done = true;
    const landingBonus = Math.max(200, CONFIG.landingPoints - Math.round(plane.damage * 6));
    mission.score += landingBonus;
    events.push({ type: 'mission-complete', score: mission.score, landingBonus });
  }
  if (plane.crashed && mission.phase !== 'complete') {
    mission.phase = 'complete';
    mission.done = true;
    events.push({ type: 'mission-failed', reason: plane.crashReason });
  }
  return events;
}

// Bearing and distance to the next target, for the HUD compass arrow.
export function targetBearing(mission, plane) {
  const target = nextTarget(mission);
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const dist = Math.hypot(dx, dz);
  let rel = Math.atan2(dx, dz) - plane.heading;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  return { distance: Math.round(dist), relativeDeg: Math.round((rel * 180) / Math.PI), label: target.label || 'Target' };
}
