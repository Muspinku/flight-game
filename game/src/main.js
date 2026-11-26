// main.js — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, crashed, mission complete.
// ?shot=cover|rings|landing|cockpit stages a screenshot scene instead of
// running the loop and sets window.__shotReady for a screenshot.
import { CONFIG, MISSIONS } from './config.js';
import { createFlight, stepFlight, readInstruments } from './flight.js';
import { createMission, updateMission } from './missions.js';
import {
  ACTION_CAMERA, ACTION_CONFIRM, ACTION_FLAPS, ACTION_MUTE, ACTION_PAUSE,
  ACTION_RESTART, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createRenderer, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const errorBox = document.getElementById('error');
window.addEventListener('error', (event) => {
  if (errorBox) errorBox.textContent = `Error: ${event.message}`;
});

const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
const hud = createHud();

let screen = SCREEN_TITLE;
let endTitle = 'CRASHED';
let missionId = 'ring-run';
let mission = createMission(missionId);
let plane = createFlight(MISSIONS[0].start);
let cockpit = false;
let message = '';
let messageUntil = 0;
let shot = null;

function fitCanvas() {
  renderer.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function startMission(id) {
  missionId = id;
  mission = createMission(id);
  const def = MISSIONS.find((m) => m.id === id) || MISSIONS[0];
  plane = createFlight(def.start);
  screen = SCREEN_PLAY;
  message = def.blurb;
  messageUntil = plane.time + 4;
  hud.show(true);
  audio.ensure();
  announce(`Mission started: ${def.name}. ${def.blurb}`);
}

function restart() {
  startMission(missionId);
}

function announce(text) {
  if (status) status.textContent = text;
}

function showMessage(text, seconds) {
  message = text;
  messageUntil = plane.time + seconds;
}

function handleActions() {
  for (const action of input.consumeActions()) {
    if (action === ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startMission(input.missionKey() || 'ring-run');
      else if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) restart();
      else audio.ensure();
    }
    if (action === ACTION_PAUSE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
    }
    if (action === ACTION_RESTART && screen !== SCREEN_TITLE) restart();
    if (action === ACTION_CAMERA) {
      cockpit = !cockpit;
      announce(cockpit ? 'Cockpit view.' : 'Chase view.');
    }
    if (action === ACTION_MUTE) {
      const muted = audio.toggleMute();
      showMessage(muted ? 'Sound off' : 'Sound on', 1.5);
    }
    if (action === ACTION_FLAPS && screen === SCREEN_PLAY) {
      plane.flaps = !plane.flaps;
      showMessage(plane.flaps ? 'Flaps down — slower, steadier' : 'Flaps up', 1.5);
    }
  }
  const picked = input.missionKey();
  if (screen === SCREEN_TITLE && picked) startMission(picked);
}

function applyEvents(events) {
  for (const event of events) {
    if (event.type === 'target') {
      audio.chime();
      showMessage(`${event.label} — +${event.points} PTS`, 2.5);
      announce(`${event.label}, plus ${event.points} points.`);
    }
    if (event.type === 'landed') {
      audio.thud();
      showMessage(event.offRunway
        ? 'IN THE GRASS — NOT THE RUNWAY'
        : (event.aligned && event.soft ? 'TOUCHDOWN — BEAUTIFUL LANDING' : 'DOWN — A BIT ROUGH, BUT DOWN'), 3);
    }
    if (event.type === 'hard-landing') {
      audio.thud();
      showMessage(`HARD LANDING — DAMAGE ${event.damage}%`, 2.5);
    }
    if (event.type === 'mission-complete') {
      screen = SCREEN_COMPLETE;
      audio.chime();
      announce(`Mission complete. Score ${event.score}.`);
    }
    if (event.type === 'mission-failed') {
      screen = SCREEN_OVER;
      endTitle = plane.crashed ? 'CRASHED' : 'MISSION FAILED';
      announce(`Mission failed. ${event.reason}`);
    }
    if (event.type === 'fuel-empty') showMessage('FUEL EMPTY — GLIDE TO THE RUNWAY', 4);
    if (event.type === 'edge') showMessage('Turning back — the sea goes on forever out there', 2);
  }
}

function frame(now) {
  const dt = Math.min(MAX_FRAME, (now - frame.last) / 1000 || 0);
  frame.last = now;
  handleActions();
  if (screen === SCREEN_PLAY) {
    const stick = input.poll();
    let acc = 0;
    while (acc < dt) {
      const step = Math.min(STEP, dt - acc);
      const events = stepFlight(plane, stick, step);
      events.push(...updateMission(mission, plane, plane.time));
      applyEvents(events);
      acc += step;
    }
    if (mission.messageUntil > plane.time) showMessage(mission.message, mission.messageUntil - plane.time);
    audio.setFlight(plane.throttle, plane.speed, screen === SCREEN_PLAY);
  }
  const instruments = readInstruments(plane);
  if (screen !== SCREEN_TITLE) hud.update(plane, mission, cockpit);
  else hud.show(false);
  renderer.render({
    plane,
    mission,
    missions: MISSIONS,
    screen,
    endTitle,
    time: now / 1000,
    cockpit,
    instruments,
    message: plane.time < messageUntil ? message : '',
  });
  requestAnimationFrame(frame);
}
frame.last = performance.now();

// Screenshot mode: stage the scene, paint it, signal readiness.
if (shotName) {
  shot = stageShot(shotName);
  if (shot) {
    plane = shot.plane;
    mission = shot.mission;
    cockpit = shot.cockpit;
    screen = shot.screen;
    message = shot.message;
    messageUntil = 9999;
    hud.show(true);
    const instruments = readInstruments(plane);
    hud.update(plane, mission, cockpit);
    renderer.render({
      plane, mission, missions: MISSIONS, screen, time: 1.2, cockpit,
      instruments, message,
    });
    renderer.render({
      plane, mission, missions: MISSIONS, screen, time: 1.25, cockpit,
      instruments, message,
    });
    window.__shotReady = true;
  }
} else {
  requestAnimationFrame(frame);
}
