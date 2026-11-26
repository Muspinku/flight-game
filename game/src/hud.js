// hud.js — the DOM instrument panel: altitude, speed, heading, fuel,
// throttle, mission objective, score and the target compass arrow.
// DOM text stays crisp in screenshots; the canvas draws the world.
import { readInstruments } from './flight.js';
import { targetBearing } from './missions.js';

export function createHud() {
  const els = {
    alt: document.getElementById('hud-alt'),
    speed: document.getElementById('hud-speed'),
    heading: document.getElementById('hud-heading'),
    vspeed: document.getElementById('hud-vspeed'),
    fuel: document.getElementById('hud-fuel'),
    fuelBar: document.getElementById('hud-fuel-bar'),
    throttle: document.getElementById('hud-throttle'),
    throttleBar: document.getElementById('hud-throttle-bar'),
    objective: document.getElementById('hud-objective'),
    rings: document.getElementById('hud-rings'),
    score: document.getElementById('hud-score'),
    time: document.getElementById('hud-time'),
    target: document.getElementById('hud-target-text'),
    arrow: document.getElementById('hud-arrow'),
    warn: document.getElementById('hud-warn'),
    panel: document.getElementById('hud'),
  };

  function setText(el, value) {
    if (el && el.textContent !== String(value)) el.textContent = String(value);
  }

  function update(plane, mission, cockpit) {
    const inst = readInstruments(plane);
    setText(els.alt, inst.altitudeFt.toLocaleString('en-US'));
    setText(els.speed, inst.speedKt);
    setText(els.heading, String(inst.headingDeg).padStart(3, '0'));
    setText(els.vspeed, (inst.verticalSpeedFpm >= 0 ? '+' : '') + inst.verticalSpeedFpm.toLocaleString('en-US'));
    setText(els.fuel, `${inst.fuelPct}%`);
    setText(els.throttle, `${inst.throttlePct}%`);
    if (els.fuelBar) els.fuelBar.style.width = `${inst.fuelPct}%`;
    if (els.throttleBar) els.throttleBar.style.width = `${inst.throttlePct}%`;
    if (els.fuelBar) els.fuelBar.className = `bar-fill${inst.fuelPct < 20 ? ' low' : ''}`;
    setText(els.score, mission ? mission.score.toLocaleString('en-US') : '0');
    const total = mission ? mission.rings.length || mission.beacons.length : 0;
    setText(els.rings, mission ? `${mission.ringsPassed}/${total || '—'}` : '—');
    const minutes = Math.floor(plane.time / 60);
    const seconds = Math.floor(plane.time % 60);
    setText(els.time, `${minutes}:${String(seconds).padStart(2, '0')}`);
    if (mission) {
      setText(els.objective, mission.phase === 'land'
        ? 'Land on runway 09'
        : mission.phase === 'complete'
          ? 'Mission complete!'
          : mission.objective);
      const bearing = targetBearing(mission, plane);
      setText(els.target, `${bearing.label} · ${bearing.distance.toLocaleString('en-US')} m`);
      if (els.arrow) els.arrow.style.transform = `rotate(${bearing.relativeDeg}deg)`;
    }
    // Warnings: stall, low fuel, terrain.
    let warn = '';
    if (plane.stalled) warn = 'STALL — NOSE DOWN, ADD THROTTLE';
    else if (plane.fuel < 20 && plane.fuel > 0) warn = 'LOW FUEL';
    else if (plane.fuel <= 0) warn = 'FUEL EMPTY — GLIDING';
    else if (plane.damage > 0 && !plane.landed) warn = `DAMAGE ${plane.damage}% — FLY GENTLY`;
    setText(els.warn, warn);
    if (els.warn) els.warn.style.display = warn ? 'block' : 'none';
    if (els.panel) els.panel.classList.toggle('cockpit', cockpit);
    return inst;
  }

  function show(showIt) {
    if (els.panel) els.panel.style.display = showIt ? 'block' : 'none';
  }

  return { update, show };
}
