(function () {
  "use strict";

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let bgmTimer = null;
  let bgmNextTime = 0;
  let bgmStep = 0;
  let enabled = true;
  let volume = 0.42;
  let unlocked = false;

  function ensureContext() {
    if (!AudioContextClass || !enabled) return null;
    if (!ctx) {
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function scheduleTone({ type = "square", frequency = 440, start = 0, duration = 0.08, gain = 0.2, slideTo = null }) {
    if (!ctx || !master || !enabled) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const t0 = now() + start;
    const t1 = t0 + duration;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t1);

    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t1);

    osc.connect(amp);
    amp.connect(master);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  function scheduleNoise({ start = 0, duration = 0.08, gain = 0.12 }) {
    if (!ctx || !master || !enabled) return;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }

    const source = ctx.createBufferSource();
    const amp = ctx.createGain();
    const t0 = now() + start;
    source.buffer = buffer;
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(amp);
    amp.connect(master);
    source.start(t0);
    source.stop(t0 + duration + 0.02);
  }

  const sounds = {
    click() {
      scheduleTone({ frequency: 720, duration: 0.035, gain: 0.12 });
      scheduleTone({ frequency: 980, start: 0.035, duration: 0.035, gain: 0.1 });
    },
    open() {
      [392, 523, 659].forEach((frequency, index) => {
        scheduleTone({ frequency, start: index * 0.045, duration: 0.07, gain: 0.13 });
      });
    },
    close() {
      [659, 523, 392].forEach((frequency, index) => {
        scheduleTone({ frequency, start: index * 0.04, duration: 0.06, gain: 0.11 });
      });
    },
    success() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        scheduleTone({ type: "square", frequency, start: index * 0.055, duration: 0.085, gain: 0.14 });
      });
    },
    fail() {
      scheduleTone({ type: "sawtooth", frequency: 220, slideTo: 92, duration: 0.22, gain: 0.13 });
      scheduleNoise({ start: 0.03, duration: 0.12, gain: 0.07 });
    },
    unlock() {
      [784, 988, 1175, 1568].forEach((frequency, index) => {
        scheduleTone({ frequency, start: index * 0.06, duration: 0.12, gain: 0.15 });
      });
    },
    warning() {
      scheduleTone({ type: "triangle", frequency: 330, duration: 0.09, gain: 0.12 });
      scheduleTone({ type: "triangle", frequency: 330, start: 0.14, duration: 0.09, gain: 0.12 });
    },
    easterEgg() {
      [523, 659, 784, 659, 1046, 784, 1175].forEach((frequency, index) => {
        scheduleTone({ type: index % 2 ? "triangle" : "square", frequency, start: index * 0.055, duration: 0.09, gain: 0.12 });
      });
    },
    bgm() {
      [392, 523, 659, 784, 659, 523, 440, 330].forEach((frequency, index) => {
        scheduleTone({ type: "square", frequency, start: index * 0.105, duration: 0.08, gain: 0.045 });
      });
    }
  };

  const bgmMelody = [
    392, 523, 659, 523, 440, 587, 698, 587,
    330, 440, 523, 440, 392, 330, 294, 330
  ];
  const bgmBass = [98, 98, 131, 131, 110, 110, 147, 147];
  const bgmBeat = 0.15;

  function scheduleBgmStep(step, start) {
    const melody = bgmMelody[step % bgmMelody.length];
    const bass = bgmBass[Math.floor(step / 4) % bgmBass.length];

    scheduleTone({
      type: "square",
      frequency: melody,
      start,
      duration: step % 4 === 0 ? 0.13 : 0.09,
      gain: step % 2 === 0 ? 0.035 : 0.026
    });

    if (step % 4 === 0) {
      scheduleTone({ type: "triangle", frequency: bass, start, duration: 0.28, gain: 0.05 });
    }

    if (step % 8 === 4) {
      scheduleTone({ type: "triangle", frequency: bass * 1.5, start, duration: 0.16, gain: 0.032 });
    }

    if (step % 2 === 1) {
      scheduleNoise({ start, duration: 0.035, gain: 0.018 });
    }
  }

  function scheduleBgmLoop() {
    if (!ctx || !enabled) return;
    const lookAhead = now() + 0.7;
    while (bgmNextTime < lookAhead) {
      scheduleBgmStep(bgmStep, Math.max(0, bgmNextTime - now()));
      bgmNextTime += bgmBeat;
      bgmStep = (bgmStep + 1) % 64;
    }
  }

  function unlock() {
    if (!enabled) return false;
    const audioContext = ensureContext();
    if (!audioContext) return false;
    unlocked = true;
    return true;
  }

  function play(soundName) {
    if (!enabled) return;
    if (!unlock()) return;
    const sound = sounds[soundName];
    if (sound) sound();
  }

  function startBgm() {
    if (!enabled || bgmTimer) return;
    if (!unlock()) return;
    bgmNextTime = now();
    bgmStep = 0;
    scheduleBgmLoop();
    bgmTimer = window.setInterval(scheduleBgmLoop, 90);
    document.documentElement.dataset.catAudioBgm = "playing";
  }

  function stopBgm() {
    if (!bgmTimer) return;
    window.clearInterval(bgmTimer);
    bgmTimer = null;
    document.documentElement.dataset.catAudioBgm = "stopped";
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!enabled) stopBgm();
  }

  function setVolume(nextVolume) {
    volume = Math.max(0, Math.min(1, Number(nextVolume) || 0));
    if (master) master.gain.value = volume;
  }

  window.CatAudio = {
    unlock,
    play,
    startBgm,
    stopBgm,
    setEnabled,
    setVolume,
    get unlocked() {
      return unlocked;
    }
  };

  document.documentElement.dataset.catAudio = "ready";
}());
