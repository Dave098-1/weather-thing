// Ambient soundscape generated entirely with the Web Audio API (no recordings).

import { clamp } from './util.js';

function noiseBuffer(ctx, brown) {
  const len = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else data[i] = white;
  }
  return buf;
}

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.on = false;
  }

  build() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.white = noiseBuffer(ctx, false);
    this.brown = noiseBuffer(ctx, true);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const loop = (buf) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };

    // Rain: hiss + low patter
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    loop(this.white).connect(hp).connect(lp).connect(this.rainGain).connect(this.master);

    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 700;
    this.rainLow = ctx.createGain();
    this.rainLow.gain.value = 0;
    loop(this.brown).connect(lp2).connect(this.rainLow).connect(this.master);

    // Wind: band-passed brown noise with a slowly wandering filter
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 0.9;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(bp.frequency);
    lfo.start();
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    loop(this.brown).connect(bp).connect(this.windGain).connect(this.master);
  }

  async enable() {
    if (!this.ctx) this.build();
    await this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.4);
  }

  disable() {
    this.on = false;
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  update(p, dayF, dt) {
    if (!this.ctx || !this.on) return;
    const t = this.ctx.currentTime;
    this.rainGain.gain.setTargetAtTime(Math.pow(p.rain, 1.2) * 0.3, t, 0.5);
    this.rainLow.gain.setTargetAtTime(p.rain * 0.35, t, 0.5);
    this.windGain.gain.setTargetAtTime(clamp((p.wind - 4) / 60) * 0.55 + p.storm * 0.12, t, 0.6);
    const birdy = dayF > 0.6 && p.rain < 0.1 && p.snow < 0.1 && p.storm < 0.1 && p.fog < 0.5;
    if (birdy && Math.random() < dt * 0.25) this.chirp();
  }

  chirp() {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2600 + Math.random() * 1800;
    let t = ctx.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 1.1, t + 0.11);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.14);
      t += 0.13 + Math.random() * 0.06;
    }
  }

  thunder(closeness) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx;
    const delay = 0.15 + (1 - closeness) * 2.2; // light travels faster than sound
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.brown;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120 + closeness * 260;
    const g = ctx.createGain();
    const peak = 0.5 + closeness * 0.9;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.08 + (1 - closeness) * 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3 + closeness);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2);
    src.stop(t + 4.5);
  }
}
