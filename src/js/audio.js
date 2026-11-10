/* ============================================================
   NEON JACKPOT — audio.js
   Sons synthétisés en WebAudio (aucun fichier externe)
   ============================================================ */
(function () {
  "use strict";

  const App = window.App;
  const U = App.utils;

  let ctx = null;
  let master = null;
  let enabled = true;
  let volume = 0.55;
  let lastTick = 0;

  const Audio = {};

  Audio.init = function () {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? volume : 0;
      master.connect(ctx.destination);
    } catch (err) {
      console.warn("[audio] WebAudio indisponible", err);
      ctx = null;
    }
    return ctx;
  };

  Audio.setEnabled = function (on) {
    enabled = !!on;
    if (master && ctx) {
      master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, 0.05);
    }
  };

  Audio.isEnabled = () => enabled;

  Audio.setVolume = function (v) {
    volume = U.clamp(v, 0, 1);
    if (master && ctx) master.gain.setTargetAtTime(enabled ? volume : 0, ctx.currentTime, 0.05);
  };

  Audio.getVolume = () => volume;

  function tone(opts) {
    if (!enabled) return;
    if (!Audio.init()) return;
    const now = ctx.currentTime + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.setValueAtTime(opts.freq, now);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), now + opts.dur);
    const vol = (opts.vol === undefined ? 0.1 : opts.vol);
    const attack = opts.attack || 0.008;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur);
    osc.connect(gain);
    if (opts.pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = opts.pan;
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    osc.start(now);
    osc.stop(now + opts.dur + 0.02);
  }

  function noise(opts) {
    if (!enabled) return;
    if (!Audio.init()) return;
    const dur = opts.dur || 0.2;
    const now = ctx.currentTime + (opts.delay || 0);
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filter || "lowpass";
    filter.frequency.setValueAtTime(opts.freq || 1800, now);
    if (opts.to) filter.frequency.exponentialRampToValueAtTime(Math.max(60, opts.to), now + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.vol === undefined ? 0.12 : opts.vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  const sounds = {
    click() {
      tone({ freq: 540, to: 420, dur: 0.045, vol: 0.045, type: "triangle" });
    },
    hover() {
      tone({ freq: 740, dur: 0.025, vol: 0.018, type: "sine" });
    },
    purchase() {
      tone({ freq: 520, dur: 0.07, vol: 0.07, type: "triangle" });
      tone({ freq: 780, dur: 0.1, vol: 0.06, type: "sine", delay: 0.06 });
      tone({ freq: 1040, dur: 0.12, vol: 0.04, type: "sine", delay: 0.12 });
    },
    coin() {
      tone({ freq: 1046, dur: 0.06, vol: 0.05, type: "sine" });
      tone({ freq: 1568, dur: 0.09, vol: 0.04, type: "sine", delay: 0.04 });
    },
    gem() {
      tone({ freq: 1318, dur: 0.09, vol: 0.05, type: "sine" });
      tone({ freq: 1975, dur: 0.14, vol: 0.035, type: "sine", delay: 0.06 });
    },
    win() {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.16, vol: 0.075, type: "triangle", delay: i * 0.065 }));
    },
    bigwin() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.22, vol: 0.08, type: "triangle", delay: i * 0.075 }));
      tone({ freq: 2093, dur: 0.5, vol: 0.025, type: "sine", delay: 0.38 });
    },
    jackpot() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.3, vol: 0.085, type: "triangle", delay: i * 0.09 }));
      [261.63, 329.63, 392, 523.25].forEach((f) => tone({ freq: f, dur: 0.8, vol: 0.03, type: "sine", delay: 0.3 }));
      noise({ dur: 1.1, vol: 0.025, freq: 8000, filter: "highpass" });
    },
    lose() {
      tone({ freq: 220, to: 110, dur: 0.3, vol: 0.07, type: "sawtooth" });
      tone({ freq: 110, to: 70, dur: 0.4, vol: 0.05, type: "sine", delay: 0.1 });
    },
    error() {
      tone({ freq: 160, dur: 0.08, vol: 0.06, type: "square" });
      tone({ freq: 120, dur: 0.12, vol: 0.05, type: "square", delay: 0.09 });
    },
    flip() {
      noise({ dur: 0.055, vol: 0.035, freq: 4200, filter: "highpass" });
      tone({ freq: 880, to: 620, dur: 0.03, vol: 0.02, type: "triangle" });
    },
    deal() {
      noise({ dur: 0.06, vol: 0.05, freq: 2600, filter: "bandpass" });
      tone({ freq: 320, to: 220, dur: 0.05, vol: 0.03, type: "triangle" });
    },
    spin() {
      noise({ dur: 0.2, vol: 0.04, freq: 1200, to: 300, filter: "bandpass" });
      tone({ freq: 180, to: 90, dur: 0.2, vol: 0.03, type: "sawtooth" });
    },
    tick() {
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
      tone({ freq: 1200 + Math.random() * 400, dur: 0.02, vol: 0.015, type: "square" });
    },
    stop() {
      tone({ freq: 220, to: 140, dur: 0.09, vol: 0.06, type: "triangle" });
      noise({ dur: 0.08, vol: 0.04, freq: 900, filter: "lowpass" });
    },
    explosion() {
      noise({ dur: 0.55, vol: 0.16, freq: 1800, to: 80, filter: "lowpass" });
      tone({ freq: 130, to: 40, dur: 0.6, vol: 0.11, type: "sawtooth" });
      noise({ dur: 0.2, vol: 0.08, freq: 4000, filter: "highpass", delay: 0.02 });
    },
    levelup() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.33, vol: 0.075, type: "sine", delay: i * 0.08 }));
      noise({ dur: 0.6, vol: 0.02, freq: 7000, filter: "highpass" });
    },
    unlock() {
      tone({ freq: 392, dur: 0.25, vol: 0.06, type: "sine" });
      tone({ freq: 587.33, dur: 0.3, vol: 0.06, type: "sine", delay: 0.1 });
      tone({ freq: 783.99, dur: 0.5, vol: 0.055, type: "sine", delay: 0.2 });
      tone({ freq: 1174.66, dur: 0.6, vol: 0.03, type: "sine", delay: 0.3 });
    },
    whoosh() {
      noise({ dur: 0.35, vol: 0.055, freq: 400, to: 3000, filter: "bandpass" });
    },
    chest() {
      noise({ dur: 0.15, vol: 0.06, freq: 900, filter: "lowpass" });
      const notes = [392, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.24, vol: 0.07, type: "triangle", delay: 0.12 + i * 0.07 }));
    },
    dice() {
      noise({ dur: 0.08, vol: 0.07, freq: 1600, filter: "bandpass" });
      tone({ freq: 160, to: 90, dur: 0.06, vol: 0.04, type: "square" });
    },
    crash() {
      tone({ freq: 440, to: 50, dur: 0.9, vol: 0.1, type: "sawtooth" });
      noise({ dur: 0.7, vol: 0.12, freq: 2200, to: 100, filter: "lowpass" });
    },
    cashout() {
      const notes = [659.25, 880, 1046.5, 1318.5];
      notes.forEach((f, i) => tone({ freq: f, dur: 0.14, vol: 0.07, type: "sine", delay: i * 0.055 }));
      sounds.coin();
    },
    horse() {
      noise({ dur: 0.1, vol: 0.05, freq: 500, filter: "bandpass" });
      tone({ freq: 300, to: 200, dur: 0.12, vol: 0.03, type: "triangle" });
    },
    notification() {
      tone({ freq: 880, dur: 0.08, vol: 0.04, type: "sine" });
      tone({ freq: 1174.66, dur: 0.13, vol: 0.035, type: "sine", delay: 0.07 });
    }
  };

  Audio.play = function (name, opts) {
    if (!enabled) return;
    const fn = sounds[name];
    if (fn) {
      try { fn(opts || {}); } catch (err) { console.warn("[audio]", name, err); }
    }
  };

  App.audio = Audio;
})();
