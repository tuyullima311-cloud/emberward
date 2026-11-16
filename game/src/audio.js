// Every sound in Emberward is synthesised with WebAudio: no audio files, nothing to load.
// The context wakes on the first key or click (browsers insist on a gesture), every call is
// guarded so a muted, missing or still-sleeping context is simply silence, and a slow pad
// of two detuned triangles hums under the fighting while a run is live.

export function createAudio() {
  let context = null;
  let master = null;
  let ambient = null;
  let muted = false;
  let lastShot = 0;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ type = 'sine', from = 440, to = null, seconds = 0.15, volume = 0.18, delay = 0 }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise({ seconds = 0.18, volume = 0.16, frequency = 900, delay = 0 }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
  }

  function startAmbient() {
    if (!context || ambient) return;
    const gain = context.createGain();
    gain.gain.value = 0.028;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const low = context.createOscillator();
    low.type = 'triangle';
    low.frequency.value = 110;
    const high = context.createOscillator();
    high.type = 'triangle';
    high.frequency.value = 164.8;
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain).connect(gain.gain);
    low.connect(filter);
    high.connect(filter);
    filter.connect(gain).connect(master);
    low.start();
    high.start();
    lfo.start();
    ambient = { gain, low, high, lfo };
  }

  function stopAmbient() {
    if (!ambient) return;
    try {
      ambient.low.stop();
      ambient.high.stop();
      ambient.lfo.stop();
    } catch {
      // Already stopped: nothing to hush.
    }
    ambient = null;
  }

  return {
    unlock,
    startAmbient,
    stopAmbient,
    get muted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },
    shoot() {
      const now = performance.now();
      if (now - lastShot < 70) return; // a volley is one sound, not a buzz
      lastShot = now;
      tone({ type: 'square', from: 720, to: 320, seconds: 0.07, volume: 0.045 });
    },
    seeker() {
      tone({ type: 'sawtooth', from: 300, to: 660, seconds: 0.12, volume: 0.03 });
    },
    hit() {
      tone({ type: 'triangle', from: 240, to: 180, seconds: 0.05, volume: 0.05 });
    },
    die() {
      noise({ seconds: 0.16, volume: 0.1, frequency: 620 });
    },
    pickup() {
      tone({ type: 'sine', from: 880, to: 1320, seconds: 0.08, volume: 0.05 });
    },
    dash() {
      noise({ seconds: 0.14, volume: 0.07, frequency: 1600 });
    },
    nova() {
      tone({ type: 'sine', from: 180, to: 720, seconds: 0.28, volume: 0.1 });
      noise({ seconds: 0.22, volume: 0.05, frequency: 2400 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 160, to: 60, seconds: 0.22, volume: 0.16 });
      noise({ seconds: 0.18, volume: 0.1, frequency: 300 });
    },
    levelup() {
      tone({ type: 'triangle', from: 523, seconds: 0.12, volume: 0.12 });
      tone({ type: 'triangle', from: 659, seconds: 0.12, volume: 0.12, delay: 0.09 });
      tone({ type: 'triangle', from: 784, seconds: 0.2, volume: 0.14, delay: 0.18 });
    },
    choose() {
      tone({ type: 'triangle', from: 660, to: 990, seconds: 0.1, volume: 0.1 });
    },
    bossWarn() {
      tone({ type: 'sawtooth', from: 55, to: 55, seconds: 1.1, volume: 0.14 });
      tone({ type: 'sawtooth', from: 58, to: 58, seconds: 1.1, volume: 0.12 });
    },
    win() {
      tone({ type: 'triangle', from: 392, seconds: 0.16, volume: 0.12 });
      tone({ type: 'triangle', from: 523, seconds: 0.16, volume: 0.12, delay: 0.13 });
      tone({ type: 'triangle', from: 659, seconds: 0.16, volume: 0.12, delay: 0.26 });
      tone({ type: 'triangle', from: 784, seconds: 0.4, volume: 0.14, delay: 0.39 });
    },
    lose() {
      tone({ type: 'triangle', from: 330, to: 110, seconds: 0.7, volume: 0.14 });
      noise({ seconds: 0.5, volume: 0.08, frequency: 220 });
    },
  };
}
