// audio.js — all sound is synthesised with WebAudio: engine hum, wind and
// chimes. No audio files, no network. Starts only after a user gesture.
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(context.destination);
      engineOsc.start();
      // Wind: looped noise through a band-pass filter.
      const noiseLength = context.sampleRate * 2;
      const buffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windGain = context.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(context.destination);
      noise.start();
      return true;
    } catch {
      return false;
    }
  }

  function setFlight(throttle, speed, flying) {
    if (!context || muted) return;
    const t = context.currentTime;
    engineOsc.frequency.setTargetAtTime(55 + throttle * 95 + speed * 0.4, t, 0.1);
    engineGain.gain.setTargetAtTime(flying ? 0.045 + throttle * 0.05 : 0, t, 0.15);
    windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.0011) : 0, t, 0.2);
  }

  function chime() {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    [880, 1318].forEach((freq, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.16, t + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.5);
      osc.connect(gain).connect(context.destination);
      osc.start(t + i * 0.09);
      osc.stop(t + i * 0.09 + 0.55);
    });
  }

  function thud() {
    if (!ensure() || muted) return;
    const t = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain).connect(context.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  function toggleMute() {
    muted = !muted;
    if (context) {
      const t = context.currentTime;
      engineGain.gain.setTargetAtTime(0, t, 0.05);
      windGain.gain.setTargetAtTime(0, t, 0.05);
    }
    return muted;
  }

  return { ensure, setFlight, chime, thud, toggleMute, isMuted: () => muted };
}
