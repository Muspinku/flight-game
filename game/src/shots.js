// shots.js — deterministic screenshot scenes. Each one stages the real
// game (real flight model, real mission, real renderer) at a fixed moment
// chosen to show the game at its best, then sets window.__shotReady so a
// screenshot tool knows the frame is ready. ?shot=cover|rings|landing|
// cockpit — the same seed always gives the same frame.
import { CONFIG, MISSIONS } from './config.js';
import { createFlight } from './flight.js';
import { createMission } from './missions.js';

function basePlane(overrides) {
  const plane = createFlight(MISSIONS[0].start);
  Object.assign(plane, overrides);
  return plane;
}

function stageCover() {
  // Chase view, mid-course: gold ring dead ahead, runway island and the
  // harbour below, HUD lit, two rings already banked.
  const plane = basePlane({
    x: 250, y: 132, z: -100, heading: 0.05, pitch: -0.02, roll: -0.18,
    speed: 64, throttle: 0.72, fuel: 78, time: 96,
  });
  const mission = createMission('ring-run');
  mission.rings[0].passed = true;
  mission.rings[1].passed = true;
  mission.nextIndex = 2;
  mission.ringsPassed = 2;
  mission.score = 500;
  mission.message = 'RING 3 AHEAD — 250 PTS';
  mission.messageUntil = 9999;
  return { plane, mission, cockpit: false, screen: 'play', message: mission.message };
}

function stageRings() {
  // Banking hard through a ring, mountain island behind, sea below.
  const plane = basePlane({
    x: -560, y: 158, z: 480, heading: -0.7, pitch: -0.03, roll: 0.55,
    speed: 71, throttle: 0.85, fuel: 61, time: 214,
  });
  const mission = createMission('ring-run');
  for (let i = 0; i < 5; i += 1) mission.rings[i].passed = true;
  mission.nextIndex = 5;
  mission.ringsPassed = 5;
  mission.score = 1250;
  mission.message = 'RING 5/8 — NICE FLYING';
  mission.messageUntil = 9999;
  return { plane, mission, cockpit: false, screen: 'play', message: mission.message };
}

function stageLanding() {
  // Short final on runway 09: gear down, flaps out, centreline ahead.
  const plane = basePlane({
    x: -620, y: 42, z: 1000, heading: Math.PI / 2, pitch: -0.06, roll: 0,
    speed: 44, throttle: 0.38, fuel: 34, time: 312, flaps: true,
  });
  const mission = createMission('ring-run');
  mission.rings.forEach((ring) => { ring.passed = true; });
  mission.nextIndex = 8;
  mission.ringsPassed = 8;
  mission.phase = 'land';
  mission.score = 2000;
  mission.message = 'FINAL — RUNWAY 09 AHEAD';
  mission.messageUntil = 9999;
  return { plane, mission, cockpit: false, screen: 'play', message: mission.message };
}

function stageCockpit() {
  // Cockpit view: dials lit, attitude ball level, next ring in the glass.
  const plane = basePlane({
    x: 90, y: 148, z: -420, heading: 0.12, pitch: 0.04, roll: -0.08,
    speed: 66, throttle: 0.75, fuel: 71, time: 142,
  });
  const mission = createMission('ring-run');
  mission.rings[0].passed = true;
  mission.nextIndex = 1;
  mission.ringsPassed = 1;
  mission.score = 250;
  mission.message = '';
  mission.messageUntil = 0;
  return { plane, mission, cockpit: true, screen: 'play', message: '' };
}

const STAGES = { cover: stageCover, rings: stageRings, landing: stageLanding, cockpit: stageCockpit };

export function stageShot(name) {
  const stage = STAGES[name];
  if (!stage) return null;
  return stage();
}

export function listShots() {
  return Object.keys(STAGES);
}
