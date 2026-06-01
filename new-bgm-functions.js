// Pixel Mixer BGM functions for cat game scenes.
// Usage:
// const ctx = new (window.AudioContext || window.webkitAudioContext)();
// const loop = playDesertBgm(ctx);
// loop.stop();

function playPixelBgm(audioContext, preset, output) {
  const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  const crusher = ctx.createWaveShaper();
  const filter = ctx.createBiquadFilter();
  const active = [];

  const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function makeCrusherCurve(amount) {
    const samples = 2048;
    const curve = new Float32Array(samples);
    const steps = Math.max(4, Math.round(128 - amount * 120));
    for (let i = 0; i < samples; i += 1) {
      const x = (i / (samples - 1)) * 2 - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  master.gain.value = 0.55;
  crusher.curve = makeCrusherCurve(preset.controls.crush);
  crusher.oversample = "none";
  filter.type = "lowpass";
  filter.frequency.value = 9200 - preset.controls.crush * 5600;

  master.connect(crusher);
  crusher.connect(filter);
  filter.connect(output || ctx.destination);

  function scheduleOnce() {
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime + 0.02;
    const speed = preset.controls.speed;
    const duration = preset.controls.duration;
    const decay = preset.controls.decay;

    preset.steps.forEach((step) => {
      const start = now + step.time / speed;
      const length = clamp((step.length * duration) / speed, 0.025, 1.6);
      const end = start + length + decay * 0.28;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = preset.wave;
      osc.frequency.setValueAtTime(midiToHz(step.note + preset.controls.pitch), start);

      if (preset.controls.vibrato > 0.01) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 5 + preset.controls.vibrato * 9;
        lfoGain.gain.value = preset.controls.vibrato * 18;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(start);
        lfo.stop(end);
        active.push(lfo, lfoGain);
      }

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(step.gain, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(end + 0.02);
      active.push(osc, gain);
    });
  }

  const loopLength = Math.max(...preset.steps.map((step) => step.time + step.length)) / preset.controls.speed + preset.controls.decay * 0.4;
  scheduleOnce();
  const timer = window.setInterval(scheduleOnce, Math.max(420, loopLength * 1000));

  return {
    ctx,
    stop() {
      window.clearInterval(timer);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03);
      window.setTimeout(() => {
        active.forEach((node) => {
          try {
            node.disconnect();
          } catch {
            // Node may already be disconnected or stopped.
          }
        });
        try {
          master.disconnect();
          crusher.disconnect();
          filter.disconnect();
        } catch {
          // Output chain may already be disconnected.
        }
      }, 120);
    }
  };
}

function playDesertBgm(audioContext, output) {
  return playPixelBgm(audioContext, {
    name: "Desert BGM",
    wave: "sawtooth",
    controls: { pitch: 0, speed: 0.72, duration: 1.18, decay: 0.78, vibrato: 0.32, crush: 0.4 },
    steps: [
      { note: 50, time: 0, length: 0.18, gain: 0.08 },
      { note: 57, time: 0.16, length: 0.12, gain: 0.07 },
      { note: 62, time: 0.32, length: 0.16, gain: 0.1 },
      { note: 61, time: 0.52, length: 0.16, gain: 0.08 },
      { note: 57, time: 0.74, length: 0.14, gain: 0.085 },
      { note: 53, time: 0.94, length: 0.16, gain: 0.075 },
      { note: 50, time: 1.12, length: 0.2, gain: 0.08 },
      { note: 65, time: 1.36, length: 0.14, gain: 0.095 },
      { note: 64, time: 1.54, length: 0.12, gain: 0.08 },
      { note: 62, time: 1.72, length: 0.22, gain: 0.1 },
      { note: 57, time: 2, length: 0.12, gain: 0.075 },
      { note: 60, time: 2.16, length: 0.14, gain: 0.08 },
      { note: 61, time: 2.34, length: 0.14, gain: 0.085 },
      { note: 57, time: 2.54, length: 0.16, gain: 0.08 },
      { note: 53, time: 2.78, length: 0.18, gain: 0.075 },
      { note: 49, time: 3.04, length: 0.3, gain: 0.07 }
    ]
  }, output);
}

function playGrasslandBgm(audioContext, output) {
  return playPixelBgm(audioContext, {
    name: "Grassland BGM",
    wave: "square",
    controls: { pitch: 0, speed: 1.02, duration: 1, decay: 0.5, vibrato: 0.1, crush: 0.18 },
    steps: [
      { note: 60, time: 0, length: 0.12, gain: 0.1 },
      { note: 64, time: 0.14, length: 0.12, gain: 0.105 },
      { note: 67, time: 0.28, length: 0.16, gain: 0.115 },
      { note: 72, time: 0.48, length: 0.18, gain: 0.108 },
      { note: 74, time: 0.7, length: 0.1, gain: 0.095 },
      { note: 76, time: 0.84, length: 0.1, gain: 0.092 },
      { note: 74, time: 0.98, length: 0.12, gain: 0.095 },
      { note: 72, time: 1.14, length: 0.16, gain: 0.1 },
      { note: 69, time: 1.36, length: 0.14, gain: 0.095 },
      { note: 67, time: 1.54, length: 0.12, gain: 0.105 },
      { note: 64, time: 1.7, length: 0.12, gain: 0.092 },
      { note: 67, time: 1.86, length: 0.18, gain: 0.108 },
      { note: 69, time: 2.12, length: 0.12, gain: 0.095 },
      { note: 72, time: 2.28, length: 0.18, gain: 0.108 },
      { note: 76, time: 2.52, length: 0.14, gain: 0.1 },
      { note: 79, time: 2.72, length: 0.2, gain: 0.105 },
      { note: 76, time: 2.98, length: 0.14, gain: 0.095 },
      { note: 72, time: 3.18, length: 0.14, gain: 0.1 },
      { note: 69, time: 3.38, length: 0.16, gain: 0.095 },
      { note: 67, time: 3.6, length: 0.28, gain: 0.108 }
    ]
  }, output);
}

function playSnowBgm(audioContext, output) {
  return playPixelBgm(audioContext, {
    name: "Snow BGM",
    wave: "triangle",
    controls: { pitch: 0, speed: 0.78, duration: 1.3, decay: 0.95, vibrato: 0.18, crush: 0.12 },
    steps: [
      { note: 79, time: 0, length: 0.22, gain: 0.074 },
      { note: 83, time: 0.28, length: 0.16, gain: 0.066 },
      { note: 86, time: 0.56, length: 0.24, gain: 0.078 },
      { note: 88, time: 0.88, length: 0.12, gain: 0.062 },
      { note: 86, time: 1.06, length: 0.18, gain: 0.07 },
      { note: 83, time: 1.32, length: 0.22, gain: 0.065 },
      { note: 78, time: 1.66, length: 0.16, gain: 0.065 },
      { note: 81, time: 1.9, length: 0.28, gain: 0.07 },
      { note: 74, time: 2.28, length: 0.2, gain: 0.058 },
      { note: 76, time: 2.58, length: 0.18, gain: 0.06 },
      { note: 79, time: 2.84, length: 0.22, gain: 0.068 },
      { note: 83, time: 3.16, length: 0.18, gain: 0.066 },
      { note: 81, time: 3.42, length: 0.22, gain: 0.064 },
      { note: 78, time: 3.74, length: 0.2, gain: 0.062 },
      { note: 71, time: 4.04, length: 0.24, gain: 0.056 },
      { note: 74, time: 4.38, length: 0.36, gain: 0.064 }
    ]
  }, output);
}

function playBoardBgm(audioContext, output) {
  return playPixelBgm(audioContext, {
    name: "Board BGM",
    wave: "square",
    controls: { pitch: 0, speed: 1.18, duration: 0.8, decay: 0.18, vibrato: 0.04, crush: 0.32 },
    steps: [
      { note: 60, time: 0, length: 0.08, gain: 0.092 },
      { note: 67, time: 0.12, length: 0.08, gain: 0.082 },
      { note: 64, time: 0.24, length: 0.08, gain: 0.094 },
      { note: 67, time: 0.36, length: 0.08, gain: 0.082 },
      { note: 62, time: 0.48, length: 0.08, gain: 0.092 },
      { note: 69, time: 0.6, length: 0.08, gain: 0.082 },
      { note: 65, time: 0.72, length: 0.08, gain: 0.094 },
      { note: 69, time: 0.84, length: 0.08, gain: 0.082 },
      { note: 64, time: 0.96, length: 0.1, gain: 0.092 },
      { note: 71, time: 1.1, length: 0.1, gain: 0.084 },
      { note: 67, time: 1.24, length: 0.12, gain: 0.095 },
      { note: 72, time: 1.4, length: 0.12, gain: 0.086 },
      { note: 71, time: 1.58, length: 0.08, gain: 0.08 },
      { note: 69, time: 1.7, length: 0.08, gain: 0.09 },
      { note: 65, time: 1.82, length: 0.1, gain: 0.084 },
      { note: 67, time: 1.98, length: 0.12, gain: 0.094 },
      { note: 55, time: 2.18, length: 0.08, gain: 0.078 },
      { note: 62, time: 2.3, length: 0.08, gain: 0.086 },
      { note: 59, time: 2.42, length: 0.08, gain: 0.08 },
      { note: 62, time: 2.54, length: 0.08, gain: 0.086 },
      { note: 57, time: 2.66, length: 0.08, gain: 0.078 },
      { note: 64, time: 2.78, length: 0.08, gain: 0.086 },
      { note: 60, time: 2.9, length: 0.12, gain: 0.092 },
      { note: 72, time: 3.08, length: 0.22, gain: 0.088 }
    ]
  }, output);
}

window.CatBgmFunctions = {
  playBoardBgm,
  playSnowBgm,
  playGrasslandBgm,
  playDesertBgm
};
