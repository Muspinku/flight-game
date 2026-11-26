// render.js — paints the world: sky, sea, terrain quads, harbour city,
// runway, rings, the Kestrel herself, cockpit view and every screen
// (title, pause, crash, mission complete). Canvas 2D, projected 3D.
import { CONFIG, PALETTE } from './config.js';
import {
  CLOUDS, CITY, RUNWAY, createProjector, groundColour, terrainHeight,
} from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const SUN_DIR = [-0.45, 0.62, -0.55];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1280;
  let height = 800;

  function resize(clientWidth, clientHeight) {
    width = clientWidth;
    height = clientHeight;
    canvas.width = Math.round(clientWidth * window.devicePixelRatio);
    canvas.height = Math.round(clientHeight * window.devicePixelRatio);
    canvas.style.width = `${clientWidth}px`;
    canvas.style.height = `${clientHeight}px`;
    ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function cameraFor(plane, cockpit) {
    const forward = [
      Math.sin(plane.heading) * Math.cos(plane.pitch),
      Math.sin(plane.pitch),
      Math.cos(plane.heading) * Math.cos(plane.pitch),
    ];
    if (cockpit) {
      return {
        pos: [plane.x + forward[0] * 1.6, plane.y + 1.1, plane.z + forward[2] * 1.6],
        forward,
      };
    }
    const back = CONFIG.chaseDistance;
    return {
      pos: [
        plane.x - forward[0] * back,
        plane.y - forward[1] * back + CONFIG.chaseHeight,
        plane.z - forward[2] * back,
      ],
      forward,
    };
  }

  function drawSky(camera, forward, time) {
    const horizonY = height * (0.5 - forward[1] * 0.9);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(Math.max(0, Math.min(1, horizonY / height)), PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.horizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, Math.max(0, horizonY + 2));
    // Sea fills below the horizon line.
    const sea = ctx.createLinearGradient(0, horizonY, 0, height);
    sea.addColorStop(0, PALETTE.seaShallow);
    sea.addColorStop(1, PALETTE.seaDeep);
    ctx.fillStyle = sea;
    ctx.fillRect(0, Math.max(0, horizonY), width, height - Math.max(0, horizonY));
    // Sun disc, projected so it sits in the sky where the sun is.
    const sunPos = [
      camera[0] + SUN_DIR[0] * 3000,
      camera[1] + SUN_DIR[1] * 3000,
      camera[2] + SUN_DIR[2] * 3000,
    ];
    const projector = createProjector(camera, forward, CONFIG.focalLength, width / 2, height / 2);
    const sun = projector.project(sunPos);
    if (sun && sun.y > -80 && sun.y < horizonY) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 90);
      glow.addColorStop(0, 'rgba(255, 246, 200, 0.95)');
      glow.addColorStop(0.25, 'rgba(255, 232, 150, 0.75)');
      glow.addColorStop(1, 'rgba(255, 232, 150, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    return { projector, horizonY };
  }

  function drawClouds(projector, time) {
    ctx.save();
    for (const cloud of CLOUDS) {
      const drift = ((time * 2 + cloud.x) % 3600) - 1800;
      const p = projector.project([cloud.x + drift * 0.2, cloud.y, cloud.z]);
      if (!p || p.depth > 3200) continue;
      const s = cloud.scale * p.scale * 0.09;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      for (let i = 0; i < cloud.puffs; i += 1) {
        const ox = (i - cloud.puffs / 2) * s * 0.9;
        ctx.beginPath();
        ctx.ellipse(p.x + ox, p.y + Math.sin(i * 2.1) * s * 0.18, s * 0.62, s * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Terrain as projected quads, far to near, with distance haze.
  function drawTerrain(projector, camera, horizonY) {
    const step = CONFIG.terrainStep;
    const half = CONFIG.worldHalfSize;
    const items = [];
    for (let gz = -half; gz < half; gz += step) {
      for (let gx = -half; gx < half; gx += step) {
        const cx = gx + step / 2;
        const cz = gz + step / 2;
        const dx = cx - camera[0];
        const dz = cz - camera[2];
        const dist = Math.hypot(dx, dz);
        if (dist > 2900) continue;
        const h00 = terrainHeight(gx, gz);
        const h10 = terrainHeight(gx + step, gz);
        const h11 = terrainHeight(gx + step, gz + step);
        const h01 = terrainHeight(gx, gz + step);
        // A quad is drawn only when its centre is above water: the sea
        // gradient below the horizon already is the sea, and drawing
        // half-drowned quads made patchwork water and stray sand blocks.
        const centreH = terrainHeight(cx, cz);
        if (centreH < 1.5) continue;
        const p00 = projector.project([gx, h00, gz]);
        if (!p00) continue;
        const p10 = projector.project([gx + step, h10, gz]);
        const p11 = projector.project([gx + step, h11, gz + step]);
        const p01 = projector.project([gx, h01, gz + step]);
        if (!p10 || !p11 || !p01) continue;
        const avgH = (h00 + h10 + h11 + h01) / 4;
        const variation = ((gx * 7 + gz * 13) % 10) / 10;
        items.push({
          depth: p00.depth + p11.depth,
          points: [p00, p10, p11, p01],
          colour: groundColour(centreH, variation),
          dist,
        });
      }
    }
    items.sort((a, b) => b.depth - a.depth);
    for (const item of items) {
      ctx.fillStyle = haze(item.colour, item.dist);
      ctx.beginPath();
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < 4; i += 1) ctx.lineTo(item.points[i].x, item.points[i].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Mix a colour toward horizon haze with distance. Accepts #rrggbb or
  // rgb(r,g,b) from groundColour.
  function haze(colour, dist) {
    const t = Math.max(0, Math.min(0.55, (dist - 1200) / 3200));
    if (t <= 0) return colour;
    let r; let g; let b;
    if (colour.startsWith('#')) {
      r = parseInt(colour.slice(1, 3), 16);
      g = parseInt(colour.slice(3, 5), 16);
      b = parseInt(colour.slice(5, 7), 16);
    } else {
      [r, g, b] = colour.slice(4, -1).split(',').map(Number);
    }
    const mix = (c) => Math.round(c + (216 - c) * t);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }

  function drawCity(projector) {
    for (const box of CITY) {
      const top = box.y + box.height;
      const corners = [
        [box.x - box.w / 2, box.y, box.z - box.d / 2],
        [box.x + box.w / 2, box.y, box.z - box.d / 2],
        [box.x + box.w / 2, box.y, box.z + box.d / 2],
        [box.x - box.w / 2, box.y, box.z + box.d / 2],
        [box.x - box.w / 2, top, box.z - box.d / 2],
        [box.x + box.w / 2, top, box.z - box.d / 2],
        [box.x + box.w / 2, top, box.z + box.d / 2],
        [box.x - box.w / 2, top, box.z + box.d / 2],
      ].map((p) => projector.project(p));
      if (corners.some((p) => !p)) continue;
      // Roof, then the two faces toward the viewer.
      ctx.fillStyle = '#5d5348';
      poly([corners[4], corners[5], corners[6], corners[7]]);
      ctx.fillStyle = shade(box.shade, 0.82);
      poly([corners[1], corners[2], corners[6], corners[5]]);
      ctx.fillStyle = shade(box.shade, 0.68);
      poly([corners[2], corners[3], corners[7], corners[6]]);
    }
  }

  function shade(hex, factor) {
    const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
    return `rgb(${r},${g},${b})`;
  }

  function poly(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawRunway(projector) {
    const y = RUNWAY.height + 0.4;
    const a = projector.project([RUNWAY.xMin, y, RUNWAY.zCentre - RUNWAY.halfWidth]);
    const b = projector.project([RUNWAY.xMax, y, RUNWAY.zCentre - RUNWAY.halfWidth]);
    const c = projector.project([RUNWAY.xMax, y, RUNWAY.zCentre + RUNWAY.halfWidth]);
    const d = projector.project([RUNWAY.xMin, y, RUNWAY.zCentre + RUNWAY.halfWidth]);
    if (!a || !b || !c || !d) return;
    ctx.fillStyle = PALETTE.runway;
    poly([a, b, c, d]);
    // Centreline dashes.
    ctx.fillStyle = PALETTE.runwayMark;
    for (let x = RUNWAY.xMin + 20; x < RUNWAY.xMax - 10; x += 60) {
      const p1 = projector.project([x, y + 0.1, RUNWAY.zCentre - 1.2]);
      const p2 = projector.project([x + 30, y + 0.1, RUNWAY.zCentre - 1.2]);
      const p3 = projector.project([x + 30, y + 0.1, RUNWAY.zCentre + 1.2]);
      const p4 = projector.project([x, y + 0.1, RUNWAY.zCentre + 1.2]);
      if (p1 && p2 && p3 && p4) poly([p1, p2, p3, p4]);
    }
    // Threshold bars at both ends.
    for (const endX of [RUNWAY.xMin + 8, RUNWAY.xMax - 8]) {
      for (let k = -2; k <= 2; k += 1) {
        const p1 = projector.project([endX - 6, y + 0.1, RUNWAY.zCentre + k * 6 - 2]);
        const p2 = projector.project([endX + 6, y + 0.1, RUNWAY.zCentre + k * 6 - 2]);
        const p3 = projector.project([endX + 6, y + 0.1, RUNWAY.zCentre + k * 6 + 2]);
        const p4 = projector.project([endX - 6, y + 0.1, RUNWAY.zCentre + k * 6 + 2]);
        if (p1 && p2 && p3 && p4) poly([p1, p2, p3, p4]);
      }
    }
  }

  function drawRing(projector, ring, isNext, index) {
    const centre = projector.project([ring.x, ring.y, ring.z]);
    if (!centre || centre.depth > 3200) return;
    const radius = CONFIG.ringRadius * centre.scale;
    if (radius < 3) return;
    const colour = ring.passed ? PALETTE.ringDone : (isNext ? PALETTE.ringNext : PALETTE.ringLater);
    ctx.save();
    ctx.globalAlpha = ring.passed ? 0.85 : (isNext ? 1 : 0.55);
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius, radius * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, radius * 0.03);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y, radius * 0.86, radius * 0.81, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (isNext) {
      ctx.fillStyle = '#1c2b33';
      ctx.font = `bold ${Math.max(11, Math.round(radius * 0.24))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`RING ${index + 1}`, centre.x, centre.y - radius - 14);
    }
    ctx.restore();
  }

  function drawBeacon(projector, beacon, isNext) {
    const p = projector.project([beacon.x, beacon.y, beacon.z]);
    if (!p || p.depth > 3200) return;
    const s = Math.max(6, 2600 / p.depth);
    ctx.save();
    ctx.globalAlpha = isNext ? 1 : 0.6;
    ctx.strokeStyle = isNext ? PALETTE.ringNext : '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2.2);
    ctx.lineTo(p.x, p.y + s * 0.6);
    ctx.stroke();
    ctx.fillStyle = isNext ? PALETTE.ringNext : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 3.2);
    ctx.lineTo(p.x + s, p.y - s * 2.2);
    ctx.lineTo(p.x - s, p.y - s * 2.2);
    ctx.closePath();
    ctx.fill();
    if (isNext) {
      ctx.fillStyle = '#1c2b33';
      ctx.font = `bold 13px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(beacon.label, p.x, p.y - s * 3.8);
    }
    ctx.restore();
  }

  // The Kestrel, seen from chase view: cream fuselage, teal wings, orange
  // stripe, spinning prop. Banks with the roll, pitches with the nose.
  function drawPlane(plane, time) {
    const cx = width / 2;
    const cy = height * 0.62;
    const scale = 1 + (plane.speed - CONFIG.cruiseSpeed) * 0.001;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-plane.roll * 0.9);
    ctx.scale(scale, scale);
    const propAngle = time * (18 + plane.throttle * 30);
    // Prop disc.
    ctx.save();
    ctx.translate(0, -6);
    ctx.rotate(propAngle % Math.PI);
    ctx.fillStyle = 'rgba(40,50,60,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Wings.
    ctx.fillStyle = PALETTE.planeTeal;
    roundRect(-118, -16, 236, 26, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.planeOrange;
    roundRect(-118, -16, 236, 7, 6);
    ctx.fill();
    // Tailplane.
    ctx.fillStyle = PALETTE.planeTeal;
    roundRect(-52, 44, 104, 16, 7);
    ctx.fill();
    // Fuselage.
    const fus = ctx.createLinearGradient(-16, 0, 16, 0);
    fus.addColorStop(0, '#d9cdb2');
    fus.addColorStop(0.5, PALETTE.planeCream);
    fus.addColorStop(1, '#c9bb9c');
    ctx.fillStyle = fus;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.quadraticCurveTo(15, -30, 15, 6);
    ctx.quadraticCurveTo(15, 46, 0, 58);
    ctx.quadraticCurveTo(-15, 46, -15, 6);
    ctx.quadraticCurveTo(-15, -30, 0, -52);
    ctx.fill();
    // Canopy.
    ctx.fillStyle = '#274b63';
    ctx.beginPath();
    ctx.ellipse(0, -18, 9, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -26, 3, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Orange stripe and tail fin.
    ctx.fillStyle = PALETTE.planeOrange;
    ctx.fillRect(-15, 26, 30, 6);
    ctx.beginPath();
    ctx.moveTo(-4, 40);
    ctx.lineTo(4, 40);
    ctx.lineTo(10, 62);
    ctx.lineTo(-10, 62);
    ctx.closePath();
    ctx.fill();
    // Nav lights.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-118, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#35d05a';
    ctx.beginPath();
    ctx.arc(118, -3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Cockpit: dashboard with live dials, yoke and windshield frame.
  function drawCockpit(plane, instruments, mission, time) {
    const panelY = height * 0.72;
    // Windshield frame.
    ctx.fillStyle = '#20262c';
    ctx.fillRect(0, 0, width, 14);
    ctx.fillRect(0, 0, 14, height);
    ctx.fillRect(width - 14, 0, 14, height);
    // Windshield centre strut: slender, so it never hides the next ring.
    ctx.beginPath();
    ctx.moveTo(width / 2 - 2, 0);
    ctx.lineTo(width / 2 + 2, 0);
    ctx.lineTo(width / 2 + 2, panelY - 130);
    ctx.lineTo(width / 2 - 2, panelY - 130);
    ctx.closePath();
    ctx.fill();
    // Dashboard panel.
    const panel = ctx.createLinearGradient(0, panelY, 0, height);
    panel.addColorStop(0, '#2b3138');
    panel.addColorStop(1, '#171b1f');
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, panelY + 26);
    ctx.quadraticCurveTo(width / 2, panelY - 34, width, panelY + 26);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    // Dials.
    const dialY = panelY + 78;
    drawDial(width * 0.2, dialY, 52, 'AIRSPEED', `${instruments.speedKt}`, 'KT');
    drawDial(width * 0.36, dialY, 52, 'ALTITUDE', `${instruments.altitudeFt}`, 'FT');
    drawAttitude(width * 0.52, dialY, 56, plane);
    drawCompass(width * 0.68, dialY, 52, instruments.headingDeg);
    drawDial(width * 0.84, dialY, 52, 'FUEL', `${instruments.fuelPct}`, '%');
    // Throttle lever.
    ctx.fillStyle = '#0c0f12';
    ctx.fillRect(width * 0.93, panelY + 30, 10, 110);
    ctx.fillStyle = PALETTE.planeOrange;
    ctx.beginPath();
    ctx.arc(width * 0.93 + 5, panelY + 130 - instruments.throttlePct * 0.9, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8d2d8';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THR', width * 0.93 + 5, panelY + 158);
    // Yoke.
    ctx.strokeStyle = '#3a424a';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 70, height - 8);
    ctx.quadraticCurveTo(width / 2, height - 62, width / 2 + 70, height - 8);
    ctx.stroke();
    ctx.fillStyle = '#3a424a';
    ctx.beginPath();
    ctx.arc(width / 2, height - 34, 16, 0, Math.PI * 2);
    ctx.fill();
    // Glareshield label.
    ctx.fillStyle = '#8fa3ad';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KESTREL  ·  ISLAND RUN', width / 2, panelY + 8);
  }

  function drawDial(x, y, r, label, value, unit) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#10151a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5b6a74';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#8fa3ad';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
      ctx.lineTo(Math.cos(a) * (r - 14), Math.sin(a) * (r - 14));
      ctx.stroke();
    }
    const num = Number.parseFloat(value) || 0;
    const frac = Math.max(0, Math.min(1, num / (label === 'FUEL' ? 100 : label === 'ALTITUDE' ? 5000 : 200)));
    const angle = -Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * (r - 16), Math.sin(angle) * (r - 16));
    ctx.stroke();
    ctx.fillStyle = '#eaf2f6';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value, 0, 8);
    ctx.fillStyle = '#8fa3ad';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(`${label} ${unit}`, 0, r + 16);
    ctx.restore();
  }

  function drawAttitude(x, y, r, plane) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(-plane.roll);
    const offset = Math.max(-r, Math.min(r, plane.pitch * r * 1.4));
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r + offset, r * 2, r - offset);
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(-r, offset, r * 2, r - offset + r);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, offset);
    ctx.lineTo(r, offset);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#5b6a74';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffc53d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x - 4, y);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x + 18, y);
    ctx.stroke();
    ctx.fillStyle = '#8fa3ad';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', x, y + r + 16);
  }

  function drawCompass(x, y, r, headingDeg) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#10151a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5b6a74';
    ctx.lineWidth = 3;
    ctx.stroke();
    const points = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
    ctx.fillStyle = '#eaf2f6';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const [label, deg] of points) {
      const a = ((deg - headingDeg) * Math.PI) / 180 - Math.PI / 2;
      ctx.fillText(label, Math.cos(a) * (r - 16), Math.sin(a) * (r - 16) + 4);
    }
    ctx.fillStyle = '#ffc53d';
    ctx.beginPath();
    ctx.moveTo(0, -r + 6);
    ctx.lineTo(-6, -r + 18);
    ctx.lineTo(6, -r + 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eaf2f6';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(String(headingDeg).padStart(3, '0'), 0, 6);
    ctx.fillStyle = '#8fa3ad';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('HEADING', 0, r + 16);
    ctx.restore();
  }

  // Mini attitude ball, top-right under the score panel (kept clear of
  // the fuel panel at bottom-left).
  function drawMiniAttitude(plane) {
    const x = width - 78;
    const y = 168;
    const r = 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-plane.roll);
    const offset = Math.max(-r, Math.min(r, plane.pitch * r * 1.4));
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r + offset, r * 2, r - offset);
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(-r, offset, r * 2, r * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, offset);
    ctx.lineTo(r, offset);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function centreText(lines, yStart, lineHeight) {
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      if (line.style) {
        ctx.font = line.style;
        ctx.fillStyle = line.colour || '#fff';
        ctx.fillText(line.text, width / 2, yStart + i * lineHeight);
      }
    });
  }

  function drawTitle(missions) {
    ctx.fillStyle = 'rgba(10, 26, 38, 0.45)';
    ctx.fillRect(0, 0, width, height);
    centreText([
      { text: 'KESTREL', style: 'bold 84px system-ui, sans-serif', colour: '#ffffff' },
      { text: 'I S L A N D   R U N', style: 'bold 30px system-ui, sans-serif', colour: '#ffc53d' },
      { text: 'Fly the rings. Mind the mountains. Grease the landing.', style: '20px system-ui, sans-serif', colour: '#d8ecf6' },
    ], height * 0.2, 78);
    missions.forEach((mission, i) => {
      const y = height * 0.48 + i * 92;
      ctx.fillStyle = 'rgba(16, 32, 44, 0.72)';
      roundRect(width / 2 - 330, y - 34, 660, 72, 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,197,61,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffc53d';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1} · ${mission.name}`, width / 2 - 306, y - 4);
      ctx.fillStyle = '#d8ecf6';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(mission.blurb, width / 2 - 306, y + 20);
    });
    centreText([
      { text: 'Arrows / WASD fly  ·  Shift / Ctrl throttle  ·  mouse steers  ·  C cockpit  ·  F flaps  ·  P pause', style: '16px system-ui, sans-serif', colour: '#c8d2d8' },
      { text: 'Press 1, 2 or 3 to pick a mission — or click to fly Ring Run', style: '16px system-ui, sans-serif', colour: '#c8d2d8' },
    ], height * 0.82, 26);
  }

  function drawOverlay(title, lines, colour) {
    ctx.fillStyle = 'rgba(10, 26, 38, 0.55)';
    ctx.fillRect(0, 0, width, height);
    centreText([
      { text: title, style: 'bold 56px system-ui, sans-serif', colour: colour || '#ffffff' },
      ...lines.map((text) => ({ text, style: '20px system-ui, sans-serif', colour: '#d8ecf6' })),
    ], height * 0.36, 44);
  }

  function render(view) {
    const { plane, mission, screen, time, cockpit, instruments, message } = view;
    const endTitle = view.endTitle || 'CRASHED';
    const cam = cameraFor(plane, cockpit);
    const { projector } = drawSky(cam.pos, cam.forward, time);
    drawClouds(projector, time);
    drawTerrain(projector, cam.pos);
    drawCity(projector);
    drawRunway(projector);
    if (mission) {
      mission.rings.forEach((ring, i) => {
        drawRing(projector, ring, mission.phase === 'fly' && i === mission.nextIndex, i);
      });
      mission.beacons.forEach((beacon, i) => {
        drawBeacon(projector, beacon, mission.phase === 'fly' && i === mission.nextIndex);
      });
    }
    if (cockpit) {
      drawCockpit(plane, instruments, mission, time);
    } else {
      drawPlane(plane, time);
      if (screen !== SCREEN_TITLE) drawMiniAttitude(plane);
    }
    if (message) {
      ctx.save();
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(message).width;
      ctx.fillStyle = 'rgba(10, 26, 38, 0.72)';
      roundRect(width / 2 - tw / 2 - 22, height * 0.16 - 32, tw + 44, 48, 10);
      ctx.fill();
      ctx.fillStyle = '#ffc53d';
      ctx.fillText(message, width / 2, height * 0.16);
      ctx.restore();
    }
    if (screen === SCREEN_TITLE) drawTitle(view.missions);
    if (screen === SCREEN_PAUSED) {
      drawOverlay('PAUSED', ['P or Esc to keep flying', 'R to restart the mission'], '#ffffff');
    }
    if (screen === SCREEN_OVER) {
      drawOverlay(endTitle, [plane.crashReason, 'Press R to fly again'], '#ff6b5e');
    }
    if (screen === SCREEN_COMPLETE) {
      drawOverlay('MISSION COMPLETE', [
        `Score ${mission ? mission.score : 0}  ·  Rings ${mission ? mission.ringsPassed : 0}`,
        'Press R to fly another mission',
      ], '#3ecf6e');
    }
  }

  return { resize, render };
}
