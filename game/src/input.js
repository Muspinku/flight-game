// input.js — keyboard and mouse. Arrows / WASD fly, W/S or wheel work the
// throttle, the mouse steers when it moves, C swaps chase and cockpit,
// P pauses, R restarts, M mutes, 1/2/3 pick a mission on the title screen.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_CAMERA = 'camera';
export const ACTION_MUTE = 'mute';
export const ACTION_FLAPS = 'flaps';

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    pitch: 0,
    roll: 0,
    throttle: 0,
    brake: false,
    mouseSteer: false,
    mouseX: 0,
    mouseY: 0,
    pressed: [], // one-shot actions consumed by the loop
  };

  function keyName(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  window.addEventListener('keydown', (event) => {
    const key = keyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(key);
    if (key === 'Enter' || key === ' ') state.pressed.push(ACTION_CONFIRM);
    if (key === 'p' || key === 'Escape') state.pressed.push(ACTION_PAUSE);
    if (key === 'r') state.pressed.push(ACTION_RESTART);
    if (key === 'c') state.pressed.push(ACTION_CAMERA);
    if (key === 'm') state.pressed.push(ACTION_MUTE);
    if (key === 'f') state.pressed.push(ACTION_FLAPS);
  });
  window.addEventListener('keyup', (event) => keys.delete(keyName(event)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (event.clientX - rect.left) / rect.width - 0.5;
    state.mouseY = (event.clientY - rect.top) / rect.height - 0.5;
    state.mouseSteer = true;
  });
  canvas.addEventListener('mouseleave', () => { state.mouseSteer = false; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    state.throttle += event.deltaY < 0 ? 0.12 : -0.12;
  }, { passive: false });
  canvas.addEventListener('mousedown', () => state.pressed.push(ACTION_CONFIRM));

  function poll() {
    // Keyboard stick.
    let pitch = 0;
    let roll = 0;
    if (keys.has('ArrowUp') || keys.has('w')) pitch -= 1;
    if (keys.has('ArrowDown') || keys.has('s')) pitch += 1;
    if (keys.has('ArrowLeft') || keys.has('a')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('d')) roll += 1;
    // W/S also throttle when the arrows are the stick: use Shift/Ctrl too.
    let throttle = state.throttle;
    state.throttle = 0;
    if (keys.has('Shift')) throttle += 1;
    if (keys.has('Control')) throttle -= 1;
    // Mouse steering blends in when the mouse has moved recently.
    if (state.mouseSteer) {
      roll += Math.max(-1, Math.min(1, state.mouseX * 2.4));
      pitch += Math.max(-1, Math.min(1, state.mouseY * 2.2));
    }
    state.pitch = Math.max(-1, Math.min(1, pitch));
    state.roll = Math.max(-1, Math.min(1, roll));
    state.throttle = Math.max(-1, Math.min(1, throttle));
    state.brake = keys.has('b');
    return state;
  }

  function consumeActions() {
    const actions = state.pressed;
    state.pressed = [];
    return actions;
  }

  function missionKey() {
    if (keys.has('1')) return 'ring-run';
    if (keys.has('2')) return 'island-tour';
    if (keys.has('3')) return 'landing-challenge';
    return null;
  }

  return { poll, consumeActions, missionKey, keys };
}
