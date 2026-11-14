import { clamp, lerp, lerpAngle, lerpAngleDeg, hexToRgb, mixRgb, rgba, mulberry32, rand } from './util.js';

const RAD = Math.PI / 180;

// Sky gradient keyframes by sun altitude (degrees): [alt, top, middle, horizon]
const SKY_KEYS = [
  [-18, '#02030a', '#070b1e', '#0d1430'],
  [-8, '#0a1030', '#1f2456', '#3d3266'],
  [-2, '#1c2a5e', '#6a4a7e', '#e0866a'],
  [3, '#2f5194', '#c77d8c', '#ffb37a'],
  [10, '#3f75c4', '#8ab4e6', '#ffd7a8'],
  [25, '#2f7fdc', '#6eb2f0', '#bfe3ff'],
  [60, '#1f6fd6', '#5aa8f0', '#a8dcff'],
].map(([a, ...cols]) => [a, ...cols.map(hexToRgb)]);

function skyColors(alt) {
  if (alt <= SKY_KEYS[0][0]) return SKY_KEYS[0].slice(1);
  for (let i = 1; i < SKY_KEYS.length; i++) {
    const [a1, ...c1] = SKY_KEYS[i];
    if (alt <= a1) {
      const [a0, ...c0] = SKY_KEYS[i - 1];
      const t = (alt - a0) / (a1 - a0);
      return c0.map((c, j) => mixRgb(c, c1[j], t));
    }
  }
  return SKY_KEYS[SKY_KEYS.length - 1].slice(1);
}

export const DEFAULT_SCENE = {
  rain: 0,
  snow: 0,
  storm: 0,
  fog: 0,
  cloud: 0.25,
  wind: 8,
  windDir: 270,
  sunAlt: -10,
  sunAz: 0.8,
  moonAlt: 30,
  moonAz: -0.6,
  moonPhase: 0.4,
  temp: 15,
  heat: 0,
};

let sharedCloudSprites = null;

const LEAF_COLORS = ['#e07a2f', '#d4a017', '#b5482a', '#8fae3b', '#c9661e'];

export class Scene {
  /**
   * @param canvas  the canvas to draw on
   * @param options.sizeTo       element whose size the canvas follows (default: the window)
   * @param options.interactive  react to the pointer (fog wiping, snow pushing, lens flare)
   */
  constructor(canvas, { reducedMotion = false, sizeTo = null, interactive = true } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = reducedMotion;
    this.sizeTo = sizeTo;
    this.interactive = interactive;
    this.running = false;
    this.p = { ...DEFAULT_SCENE };
    this.target = { ...DEFAULT_SCENE };
    this.t = 0;
    this.mouse = { x: -9999, y: -9999, active: false };
    this.trail = [];
    this.drops = [];
    this.splashes = [];
    this.flakes = [];
    this.leaves = [];
    this.glass = [];
    this.clouds = [];
    this.bursts = [];
    this.shooting = [];
    this.groundSnow = 0;
    this.bolt = null;
    this.nextStrike = 2;
    this.onStrike = null;
    this.cloudsReady = false;

    this.stars = Array.from({ length: 260 }, () => ({
      x: Math.random(),
      y: Math.random() ** 1.3 * 0.85,
      r: Math.random() ** 3 * 1.5 + 0.35,
      tw: Math.random() * 6.28,
      sp: 0.6 + Math.random() * 2.2,
    }));
    this.fogBlobs = Array.from({ length: 12 }, () => ({
      x: Math.random(),
      y: 0.3 + Math.random() * 0.7,
      r: 0.25 + Math.random() * 0.3,
      sp: 0.004 + Math.random() * 0.012,
    }));
    sharedCloudSprites ??= makeCloudSprites(8);
    this.cloudSprites = sharedCloudSprites;
    this.hills = [makeHill(11), makeHill(29)];
    this.fogCanvas = document.createElement('canvas');
    this.fogCtx = this.fogCanvas.getContext('2d');

    this.resize();
    if (sizeTo) new ResizeObserver(() => this.resize()).observe(sizeTo);
    else addEventListener('resize', () => this.resize());
    if (interactive) {
      addEventListener('pointermove', (e) => this.pointer(e.clientX, e.clientY));
      document.addEventListener('pointerleave', () => (this.mouse.active = false));
    }
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = Math.max(1, this.sizeTo ? this.sizeTo.clientWidth : innerWidth);
    this.h = Math.max(1, this.sizeTo ? this.sizeTo.clientHeight : innerHeight);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.fogCanvas.width = Math.ceil(this.w / 4);
    this.fogCanvas.height = Math.ceil(this.h / 4);
    this.areaScale = clamp((this.w * this.h) / (1400 * 850), 0.06, 1.6) * (this.reduced ? 0.35 : 1);
    this.sizeScale = clamp(this.w / 1300, 0.25, 1.2);
    this.vScale = clamp(this.h / 800, 0.3, 1.2);
  }

  pointer(x, y) {
    const m = this.mouse;
    const now = performance.now();
    m.x = x;
    m.y = y;
    m.active = true;
    if (!m.last || now - m.last > 30) {
      m.last = now;
      this.trail.push({ x, y, life: 1 });
      if (this.trail.length > 60) this.trail.shift();
    }
  }

  setTarget(t) {
    Object.assign(this.target, t);
  }

  /** Skip the smooth transition and show the target right away. */
  jump() {
    Object.assign(this.p, this.target);
    this.cloudsReady = false;
    this.clouds = [];
    this.jumped = true; // fill the sky with rain/snow straight away
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.render(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  // ---------- helpers ----------

  hillY(layer, x) {
    const base = layer === 0 ? 0.8 : 0.885;
    const amp = layer === 0 ? 0.055 : 0.035;
    return this.h * (base - amp * this.hills[layer](x / this.w));
  }

  groundY(x) {
    return this.hillY(1, x);
  }

  /** Map a sky position (altitude in degrees, azimuth in radians from south) to the screen. */
  skyPos(alt, az) {
    const horizon = this.h * 0.82;
    return {
      x: this.w * (0.5 + 0.42 * Math.sin(az)),
      y: horizon - clamp(alt / 70, -0.2, 1) * horizon * 0.82,
    };
  }

  get dayF() {
    return clamp((this.p.sunAlt + 6) / 14);
  }

  get nightF() {
    return clamp((-this.p.sunAlt - 3) / 9);
  }

  get windX() {
    return -Math.sin(this.p.windDir * RAD);
  }

  // ---------- simulation ----------

  update(dt) {
    this.t += dt;
    if (this.jumped && this.t > 0.5) this.jumped = false;
    const k = 1 - Math.exp(-dt * 1.8);
    for (const key in this.target) {
      const a = this.p[key];
      const b = this.target[key];
      if (key === 'windDir') this.p[key] = lerpAngleDeg(a, b, k);
      else if (key === 'sunAz' || key === 'moonAz') this.p[key] = lerpAngle(a, b, k);
      else this.p[key] = lerp(a, b, k);
    }

    for (const tp of this.trail) tp.life -= dt / 2.5;
    this.trail = this.trail.filter((tp) => tp.life > 0);

    this.updateClouds(dt);
    this.updateRain(dt);
    this.updateSnow(dt);
    this.updateLeaves(dt);
    this.updateGlass(dt);
    this.updateLightning(dt);
    this.updateBursts(dt);

    const p = this.p;
    if (p.snow > 0.2) this.groundSnow = Math.min(1, this.groundSnow + dt * p.snow * 0.05);
    else this.groundSnow = Math.max(0, this.groundSnow - dt * 0.03);

    if (this.nightF > 0.5 && p.cloud < 0.7 && Math.random() < dt * 0.1) this.addShootingStar();
    for (const s of this.shooting) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt / s.dur;
    }
    this.shooting = this.shooting.filter((s) => s.life > 0);
  }

  addShootingStar(x, y) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const speed = rand(500, 900);
    this.shooting.push({
      x: x ?? rand(this.w * 0.1, this.w * 0.9),
      y: y ?? rand(0, this.h * 0.35),
      vx: dir * speed * 0.85,
      vy: speed * 0.45,
      life: 1,
      dur: rand(0.6, 1.1),
    });
  }

  spawnCloud(atEdge, dir) {
    const layer = Math.random();
    const s = (0.45 + layer * 0.8) * Math.max(this.sizeScale, 0.6 * Math.min(1, this.w / 700));
    const sprite = this.cloudSprites[(Math.random() * this.cloudSprites.length) | 0];
    const w = sprite.w * s;
    const x = atEdge ? (dir > 0 ? -w : this.w) : rand(-w * 0.5, this.w - w * 0.5);
    const cloud = {
      x,
      y: this.h * rand(-0.04, 0.36) - sprite.h * s * 0.3 + (1 - layer) * this.h * 0.08,
      s,
      layer,
      sprite,
      alpha: atEdge ? 1 : 0,
      dying: false,
      jit: rand(0.8, 1.2),
    };
    const i = this.clouds.findIndex((c) => c.layer > layer);
    if (i < 0) this.clouds.push(cloud);
    else this.clouds.splice(i, 0, cloud);
  }

  updateClouds(dt) {
    const p = this.p;
    let dir = this.windX;
    if (Math.abs(dir) < 0.3) dir = dir < 0 ? -0.3 : 0.3;
    const target = Math.round(p.cloud * 18 * clamp(this.w / 1300, 0.3, 1.5));
    let alive = this.clouds.filter((c) => !c.dying).length;
    if (!this.cloudsReady) {
      while (alive < target) {
        this.spawnCloud(false, dir);
        alive++;
      }
      this.cloudsReady = true;
    }
    if (alive < target && Math.random() < dt * 4) this.spawnCloud(false, dir);
    if (alive > target && Math.random() < dt * 4) {
      const living = this.clouds.filter((c) => !c.dying);
      living[(Math.random() * living.length) | 0].dying = true;
    }
    for (const c of this.clouds) {
      const vx = dir * (6 + p.wind * 1.4) * (0.35 + c.layer * 0.9) * c.jit;
      c.x += vx * dt;
      const w = c.sprite.w * c.s;
      if (c.x > this.w + 10 && vx > 0) c.x = -w;
      if (c.x < -w - 10 && vx < 0) c.x = this.w;
      c.alpha = clamp(c.alpha + (c.dying ? -dt * 0.5 : dt * 0.5));
    }
    this.clouds = this.clouds.filter((c) => !(c.dying && c.alpha <= 0));
  }

  newDrop(top) {
    const z = Math.random() ** 0.7;
    const spread = this.w * 0.3;
    return {
      x: rand(-spread, this.w + spread) - this.windX * this.p.wind * 3,
      y: top ? rand(-this.h * 0.6, -20) : rand(-this.h, this.h),
      z,
    };
  }

  updateRain(dt) {
    const p = this.p;
    const target = Math.round(p.rain * 750 * this.areaScale);
    const fresh = this.drops.length === 0 && this.jumped;
    while (this.drops.length < target) this.drops.push(this.newDrop(!fresh));
    const windPx = this.windX * p.wind * 7;
    const speedMul = 0.8 + p.rain * 0.45;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y += (700 + d.z * 750) * speedMul * this.vScale * dt;
      d.x += windPx * (0.5 + d.z * 0.5) * dt;
      if (d.y > this.groundY(d.x) + d.z * 40 - 20) {
        if (d.z > 0.7 && Math.random() < 0.5) this.splash(d.x, d.y);
        if (this.drops.length > target) this.drops.splice(i, 1);
        else Object.assign(d, this.newDrop(true));
      }
    }
    for (const s of this.splashes) {
      s.vy += 1400 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt / 0.35;
    }
    this.splashes = this.splashes.filter((s) => s.life > 0);
  }

  splash(x, y) {
    if (this.splashes.length > 400) return;
    for (let i = 0; i < 3; i++) {
      this.splashes.push({ x, y, vx: rand(-90, 90), vy: rand(-260, -120), life: 1 });
    }
  }

  updateSnow(dt) {
    const p = this.p;
    const target = Math.round(p.snow * 480 * this.areaScale);
    const fresh = this.flakes.length === 0 && this.jumped;
    while (this.flakes.length < target) {
      this.flakes.push({
        x: rand(-50, this.w + 50),
        y: fresh ? rand(-10, this.h) : rand(-this.h * 0.8, -10),
        z: Math.random() ** 0.8,
        ph: Math.random() * 6.28,
      });
    }
    // When the snow stops, let the leftover flakes melt away instead of lingering.
    const excess = this.flakes.length - target;
    if (excess > 0 && Math.random() < dt * 8) {
      this.flakes.splice(0, Math.max(1, Math.ceil(excess * 0.03)));
    }
    const windPx = this.windX * p.wind * 2.2;
    const m = this.mouse;
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i];
      f.y += (22 + f.z * 60) * (0.7 + p.snow * 0.5) * Math.max(0.6, this.vScale) * dt;
      f.x += (windPx * f.z + Math.sin(this.t * 1.3 + f.ph) * 22 * f.z) * dt;
      if (m.active) {
        const dx = f.x - m.x;
        const dy = f.y - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 130 && dist > 0.1) {
          const push = (130 - dist) * 5 * dt;
          f.x += (dx / dist) * push;
          f.y += (dy / dist) * push;
        }
      }
      if (f.y > this.groundY(f.x) + f.z * 30) {
        if (this.flakes.length > target) this.flakes.splice(i, 1);
        else {
          f.y = rand(-60, -10);
          f.x = rand(-50, this.w + 50) - windPx * 2;
        }
      }
      if (f.x > this.w + 60) f.x = -50;
      if (f.x < -60) f.x = this.w + 50;
    }
  }

  updateLeaves(dt) {
    const p = this.p;
    const target =
      p.wind > 22 && p.snow < 0.3 && p.rain < 0.6
        ? Math.round(clamp((p.wind - 22) * 0.7, 0, 28) * (this.reduced ? 0.4 : 1))
        : 0;
    const dir = this.windX >= 0 ? 1 : -1;
    while (this.leaves.length < target) {
      this.leaves.push({
        x: dir > 0 ? rand(-200, -20) : rand(this.w + 20, this.w + 200),
        y: rand(this.h * 0.1, this.h * 0.85),
        rot: Math.random() * 6.28,
        vr: rand(-6, 6),
        size: rand(5, 11),
        color: LEAF_COLORS[(Math.random() * LEAF_COLORS.length) | 0],
        speed: rand(0.7, 1.4),
        ph: Math.random() * 6.28,
      });
    }
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const l = this.leaves[i];
      l.x += dir * p.wind * 9 * l.speed * dt;
      l.y += (30 + Math.sin(this.t * 2 + l.ph) * 90) * dt;
      l.rot += l.vr * dt;
      const out = l.x > this.w + 220 || l.x < -220 || l.y > this.h + 20;
      if (out) {
        if (this.leaves.length > target) this.leaves.splice(i, 1);
        else {
          l.x = dir > 0 ? rand(-200, -20) : rand(this.w + 20, this.w + 200);
          l.y = rand(this.h * 0.05, this.h * 0.7);
        }
      }
    }
  }

  updateGlass(dt) {
    const p = this.p;
    const target = p.rain > 0.5 ? Math.round(((p.rain - 0.5) / 0.5) * 40 * (this.reduced ? 0.4 : 1)) : 0;
    if (this.glass.length < target && Math.random() < dt * 6) {
      this.glass.push({ x: rand(0, this.w), y: rand(0, this.h * 0.9), r: rand(2, 7), vy: 0, alpha: 0 });
    }
    for (let i = this.glass.length - 1; i >= 0; i--) {
      const g = this.glass[i];
      g.alpha = Math.min(1, g.alpha + dt * 2);
      if (g.vy === 0 && g.r > 4 && Math.random() < dt * 0.35) g.vy = rand(40, 140);
      if (g.vy > 0 && Math.random() < dt * 0.6) g.vy = 0; // sticky glass: drops stutter
      g.y += g.vy * dt;
      const gone = g.y > this.h + 10 || (this.glass.length > target && Math.random() < dt * 0.5);
      if (gone) this.glass.splice(i, 1);
    }
  }

  makeBolt(x, y, yEnd, spread, depth) {
    const pts = [[x, y]];
    const branches = [];
    while (y < yEnd) {
      y += rand(12, 38);
      x += (Math.random() - 0.5) * spread;
      pts.push([x, y]);
      if (depth < 2 && Math.random() < 0.1) {
        branches.push(this.makeBolt(x, y, y + (yEnd - y) * rand(0.25, 0.6), spread * 0.8, depth + 1));
      }
    }
    return { pts, branches, depth };
  }

  updateLightning(dt) {
    const p = this.p;
    if (this.bolt) {
      this.bolt.age += dt;
      if (this.bolt.age > 1.2) this.bolt = null;
    }
    if (p.storm < 0.25) return;
    this.nextStrike -= dt;
    if (this.nextStrike <= 0) {
      this.nextStrike = rand(3, 10) / p.storm;
      this.strike();
    }
  }

  strike() {
    const close = Math.random();
    const x = rand(this.w * 0.1, this.w * 0.9);
    this.bolt = {
      age: 0,
      close,
      tree: close > 0.3 ? this.makeBolt(x, 0, this.groundY(x) * rand(0.7, 1), 45, 0) : null,
    };
    this.onStrike?.(close);
  }

  burst(x, y) {
    const p = this.p;
    let kind = 'sparkle';
    if (p.snow > 0.3) kind = 'flake';
    else if (p.rain > 0.3) kind = 'ripple';
    else if (this.nightF > 0.6) kind = 'night';

    if (kind === 'ripple') {
      for (let i = 0; i < 3; i++) this.bursts.push({ kind: 'ring', x, y, r: 0, delay: i * 0.15, life: 1 });
      return;
    }
    if (kind === 'night') this.addShootingStar(x, y);
    const n = kind === 'flake' ? 30 : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rand(80, 260);
      this.bursts.push({
        kind: kind === 'flake' ? 'flake' : 'star',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: Math.random() * 6.28,
        size: rand(3, 7),
        life: 1,
        dur: rand(0.8, 1.5),
        color: kind === 'night' ? '#cfe0ff' : Math.random() < 0.5 ? '#ffe27a' : '#ffffff',
      });
    }
  }

  updateBursts(dt) {
    for (const b of this.bursts) {
      if (b.kind === 'ring') {
        if (b.delay > 0) {
          b.delay -= dt;
          continue;
        }
        b.r += 110 * dt;
        b.life -= dt / 1.1;
      } else {
        b.vx *= 1 - dt * 2.2;
        b.vy = b.vy * (1 - dt * 2.2) + (b.kind === 'flake' ? 40 : 60) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += dt * 3;
        b.life -= dt / b.dur;
      }
    }
    this.bursts = this.bursts.filter((b) => b.life > 0);
  }

  // ---------- rendering ----------

  render() {
    const { ctx, w, h, p } = this;
    const dayF = this.dayF;
    const nightF = this.nightF;
    const gloom = clamp(p.cloud * 0.45 + p.storm * 0.35 + p.rain * 0.25 + p.fog * 0.35 + p.snow * 0.15, 0, 0.85);

    // Sky
    let [top, mid, bot] = skyColors(p.sunAlt);
    top = mixRgb(top, mixRgb([14, 16, 22], [92, 102, 118], dayF), gloom);
    mid = mixRgb(mid, mixRgb([22, 26, 34], [130, 140, 155], dayF), gloom);
    bot = mixRgb(bot, mixRgb([30, 34, 44], [165, 172, 182], dayF), gloom);
    this.skyBot = bot;
    const horizon = h * 0.82;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, rgba(top));
    g.addColorStop(clamp((horizon * 0.55) / h), rgba(mid));
    g.addColorStop(clamp(horizon / h), rgba(bot));
    g.addColorStop(1, rgba(bot));
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    this.drawStars(nightF);
    this.drawMoon(dayF);
    const sun = this.drawSun();
    this.drawClouds(dayF);
    this.drawHills(dayF, gloom);
    this.drawHeat();
    this.drawRain(dayF);
    this.drawSnow();
    this.drawLeaves();
    this.drawLightning();
    this.drawFog(dayF);
    this.drawGlass();
    if (sun) this.drawFlare(sun);
    this.drawBursts();
  }

  drawStars(nightF) {
    const { ctx, w, h, p } = this;
    const alpha = nightF * (1 - p.cloud * 0.85) * (1 - p.fog * 0.9);
    if (alpha < 0.01) return;
    const horizon = h * 0.82;
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const a = alpha * (0.55 + 0.45 * Math.sin(this.t * s.sp + s.tw));
      ctx.globalAlpha = a;
      const x = s.x * w;
      const y = s.y * horizon;
      if (s.r < 1) ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
      else {
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const s of this.shooting) {
      const len = 120;
      const n = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / n) * len;
      const ty = s.y - (s.vy / n) * len;
      const gr = ctx.createLinearGradient(s.x, s.y, tx, ty);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = Math.min(1, s.life * 2) * Math.max(alpha, 0.6);
      ctx.strokeStyle = gr;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawMoon(dayF) {
    const { ctx, p } = this;
    if (p.moonAlt < -4) return;
    const vis = (1 - p.cloud * 0.7) * (1 - p.fog * 0.8) * lerp(1, 0.35, dayF) * clamp((p.moonAlt + 4) / 6);
    if (vis < 0.02) return;
    const { x, y } = this.skyPos(p.moonAlt, p.moonAz);
    const r = clamp(Math.min(this.w, this.h) * 0.045, 9, 46);

    ctx.globalAlpha = vis;
    const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 5);
    glow.addColorStop(0, 'rgba(230,236,255,0.28)');
    glow.addColorStop(1, 'rgba(230,236,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);

    // Earthshine on the dark side
    ctx.fillStyle = 'rgba(200,210,240,0.10)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const phase = p.moonPhase;
    const k = Math.cos(2 * Math.PI * phase); // 1 = new, -1 = full
    ctx.save();
    ctx.beginPath();
    if (phase < 0.5) {
      ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
      ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    } else {
      ctx.arc(x, y, r, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.ellipse(x, y, Math.abs(k) * r, r, 0, -Math.PI / 2, Math.PI / 2, k > 0);
    }
    ctx.closePath();
    ctx.fillStyle = '#f5f1df';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(150,145,130,0.25)';
    for (const [cx, cy, cr] of [[-0.3, -0.25, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.1]]) {
      ctx.beginPath();
      ctx.arc(x + cx * r, y + cy * r, cr * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawSun() {
    const { ctx, p } = this;
    if (p.sunAlt < -5) return null;
    const vis =
      clamp(1 - p.cloud * 0.75 - p.storm * 0.5 - p.fog * 0.6 - p.rain * 0.3) * clamp((p.sunAlt + 5) / 6);
    const { x, y } = this.skyPos(p.sunAlt, p.sunAz);
    const R = clamp(Math.min(this.w, this.h) * 0.05, 10, 52);
    const warm = clamp(p.sunAlt / 20);
    const core = mixRgb([255, 140, 70], [255, 248, 220], warm);
    const glowCol = mixRgb([255, 120, 60], [255, 230, 160], warm);

    ctx.globalCompositeOperation = 'lighter';
    // Big soft glow (visible a little even through clouds)
    const glowA = 0.18 + vis * 0.35;
    const glow = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 8);
    glow.addColorStop(0, rgba(glowCol, glowA));
    glow.addColorStop(0.4, rgba(glowCol, glowA * 0.35));
    glow.addColorStop(1, rgba(glowCol, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(x - R * 8, y - R * 8, R * 16, R * 16);

    if (vis > 0.02) {
      // Rotating rays
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.t * 0.05);
      const rayGrad = ctx.createLinearGradient(0, 0, R * 6, 0);
      rayGrad.addColorStop(0, rgba(glowCol, 0.12 * vis));
      rayGrad.addColorStop(1, rgba(glowCol, 0));
      ctx.fillStyle = rayGrad;
      for (let i = 0; i < 12; i++) {
        ctx.rotate((Math.PI * 2) / 12);
        const len = i % 2 ? 4.5 : 6;
        ctx.beginPath();
        ctx.moveTo(R * 0.6, -R * 0.12);
        ctx.lineTo(R * len, -R * 0.45);
        ctx.lineTo(R * len, R * 0.45);
        ctx.lineTo(R * 0.6, R * 0.12);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.25 + vis * 0.75;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, R);
    cg.addColorStop(0, '#fffef6');
    cg.addColorStop(0.7, rgba(core));
    cg.addColorStop(1, rgba(core, 0.85));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return p.sunAlt > 1 && vis > 0.3 ? { x, y, vis, R } : null;
  }

  drawClouds(dayF) {
    const { ctx, p } = this;
    const dark = clamp(p.storm * 0.85 + p.rain * 0.45 + p.snow * 0.2 + (1 - dayF) * 0.8, 0, 0.95);
    for (const c of this.clouds) {
      const w = c.sprite.w * c.s;
      const h = c.sprite.h * c.s;
      const a = c.alpha * (0.72 + c.layer * 0.28);
      ctx.globalAlpha = a;
      ctx.drawImage(c.sprite.light, c.x, c.y, w, h);
      if (dark > 0.02) {
        ctx.globalAlpha = a * dark;
        ctx.drawImage(c.sprite.dark, c.x, c.y, w, h);
      }
    }
    ctx.globalAlpha = 1;
    // Overcast ceiling
    if (p.cloud > 0.6) {
      const col = mixRgb(mixRgb([20, 24, 32], [150, 158, 170], dayF), [60, 64, 74], p.storm * 0.7);
      const a = (p.cloud - 0.6) * 2;
      const g = ctx.createLinearGradient(0, 0, 0, this.h * 0.55);
      g.addColorStop(0, rgba(col, a * 0.85));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h * 0.55);
    }
  }

  drawHills(dayF, gloom) {
    const { ctx, w, h } = this;
    const layers = [
      { day: [91, 127, 163], night: [16, 24, 46] },
      { day: [59, 101, 82], night: [8, 13, 24] },
    ];
    const snowCol = mixRgb([120, 135, 170], [236, 242, 250], dayF);
    layers.forEach((L, i) => {
      let col = mixRgb(L.night, L.day, dayF);
      col = mixRgb(col, [70, 76, 86], gloom * 0.45);
      if (i === 0) col = mixRgb(col, this.skyBot, 0.25);
      col = mixRgb(col, snowCol, this.groundSnow * (i === 0 ? 0.75 : 0.9));
      ctx.fillStyle = rgba(col);
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w + 8; x += 8) ctx.lineTo(x, this.hillY(i, x));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });
  }

  /** Heat haze: wobble horizontal strips of the picture near the ground. */
  drawHeat() {
    const { ctx, w, h, p } = this;
    if (p.heat < 0.02) return;
    const top = h * 0.55;
    const band = h - top;
    // Warm haze over the horizon
    const g = ctx.createLinearGradient(0, top, 0, h);
    g.addColorStop(0, 'rgba(255,190,120,0)');
    g.addColorStop(0.5, `rgba(255,190,120,${p.heat * 0.16})`);
    g.addColorStop(1, `rgba(255,170,100,${p.heat * 0.1})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, band);
    if (this.reduced) return;
    const step = 3;
    const dpr = this.dpr;
    for (let y = top; y < h; y += step) {
      const depth = (y - top) / band;
      const off = Math.sin(y * 0.09 + this.t * 7) * Math.sin(y * 0.023 - this.t * 2.3) * p.heat * 4 * depth;
      if (Math.abs(off) < 0.2) continue;
      ctx.drawImage(this.canvas, 0, y * dpr, this.canvas.width, step * dpr, off, y, w, step);
    }
  }

  drawRain(dayF) {
    const { ctx, p } = this;
    if (!this.drops.length && !this.splashes.length) return;
    const col = mixRgb([160, 180, 220], [225, 235, 255], dayF);
    const windPx = this.windX * p.wind * 7;
    const speedMul = 0.8 + p.rain * 0.45;
    const lenMul = 0.45 + p.rain * 0.8;
    const buckets = [
      [0, 0.45, 0.22, 1],
      [0.45, 0.75, 0.38, 1.2],
      [0.75, 1.01, 0.6, 1.6],
    ];
    ctx.lineCap = 'round';
    for (const [lo, hi, a, lw] of buckets) {
      ctx.strokeStyle = rgba(col, a);
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (const d of this.drops) {
        if (d.z < lo || d.z >= hi) continue;
        const vy = (700 + d.z * 750) * speedMul * this.vScale;
        const vx = windPx * (0.5 + d.z * 0.5);
        const len = (10 + d.z * 22) * lenMul * this.vScale;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - (vx / vy) * len, d.y - len);
      }
      ctx.stroke();
    }
    ctx.fillStyle = rgba(col, 0.7);
    for (const s of this.splashes) {
      ctx.globalAlpha = s.life;
      ctx.fillRect(s.x, s.y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }

  drawSnow() {
    const { ctx } = this;
    if (!this.flakes.length) return;
    const buckets = [
      [0, 0.4, 0.5],
      [0.4, 0.75, 0.75],
      [0.75, 1.01, 0.95],
    ];
    for (const [lo, hi, a] of buckets) {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      for (const f of this.flakes) {
        if (f.z < lo || f.z >= hi) continue;
        const r = 0.8 + f.z * 2.8;
        ctx.moveTo(f.x + r, f.y);
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  drawLeaves() {
    const { ctx } = this;
    for (const l of this.leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(1, Math.abs(Math.sin(l.rot * 0.7)) * 0.7 + 0.3); // fake 3D flip
      ctx.fillStyle = l.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,40,10,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-l.size * 1.3, 0);
      ctx.lineTo(l.size, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  flashLevel() {
    const b = this.bolt;
    if (!b) return 0;
    const a = b.age;
    let f;
    if (this.reduced) f = Math.max(0, 0.5 * Math.exp(-a * 5));
    else if (a < 0.07) f = 1;
    else if (a < 0.13) f = 0.25;
    else if (a < 0.2) f = 0.85;
    else f = 0.85 * Math.exp(-(a - 0.2) * 6);
    return f * (0.35 + b.close * 0.65);
  }

  drawLightning() {
    const { ctx, w, h } = this;
    const f = this.flashLevel();
    if (f <= 0.001) return;
    ctx.fillStyle = `rgba(215,225,255,${f * (this.reduced ? 0.15 : 0.45)})`;
    ctx.fillRect(0, 0, w, h);
    if (!this.bolt.tree) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = '#9fb8ff';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = `rgba(240,245,255,${Math.min(1, f * 1.2)})`;
    ctx.lineJoin = 'round';
    const draw = (b) => {
      ctx.lineWidth = b.depth === 0 ? 3 : 1.5 / b.depth;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      b.branches.forEach(draw);
    };
    draw(this.bolt.tree);
    ctx.restore();
  }

  drawFog(dayF) {
    const { p } = this;
    if (p.fog < 0.01) return;
    const fc = this.fogCtx;
    const W = this.fogCanvas.width;
    const H = this.fogCanvas.height;
    const col = mixRgb([58, 67, 86], [223, 229, 236], dayF);
    fc.globalCompositeOperation = 'source-over';
    fc.clearRect(0, 0, W, H);
    const base = fc.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, rgba(col, p.fog * 0.3));
    base.addColorStop(1, rgba(col, p.fog * 0.75));
    fc.fillStyle = base;
    fc.fillRect(0, 0, W, H);
    for (const b of this.fogBlobs) {
      const x = ((((b.x + this.t * b.sp * (this.windX >= 0 ? 1 : -1)) % 1.6) + 1.6) % 1.6 - 0.3) * W;
      const y = b.y * H;
      const r = b.r * W;
      const g = fc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, p.fog * 0.5));
      g.addColorStop(1, rgba(col, 0));
      fc.fillStyle = g;
      fc.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Wipe the fog away where the pointer has been
    fc.globalCompositeOperation = 'destination-out';
    for (const tp of this.trail) {
      const x = tp.x / 4;
      const y = tp.y / 4;
      const r = 38;
      const g = fc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${tp.life * 0.5})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      fc.fillStyle = g;
      fc.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.ctx.drawImage(this.fogCanvas, 0, 0, this.w, this.h);
  }

  drawGlass() {
    const { ctx } = this;
    for (const g of this.glass) {
      const stretch = g.vy > 0 ? 1.5 : 1;
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(g.x, g.y, g.r, g.r * stretch, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.arc(g.x - g.r * 0.35, g.y - g.r * 0.4 * stretch, g.r * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawFlare(sun) {
    const { ctx, w, h, mouse } = this;
    const cx = mouse.active ? mouse.x : w / 2;
    const cy = mouse.active ? mouse.y : h / 2;
    const dx = cx - sun.x;
    const dy = cy - sun.y;
    const ghosts = [
      [0.35, 0.35, [255, 220, 150]],
      [0.6, 0.18, [160, 255, 200]],
      [0.85, 0.6, [150, 190, 255]],
      [1.15, 0.25, [255, 170, 220]],
      [1.45, 0.9, [255, 230, 170]],
    ];
    ctx.globalCompositeOperation = 'lighter';
    for (const [t, size, col] of ghosts) {
      const x = sun.x + dx * t;
      const y = sun.y + dy * t;
      const r = sun.R * size * 1.6;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(col, 0.1 * sun.vis));
      g.addColorStop(0.7, rgba(col, 0.06 * sun.vis));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  drawBursts() {
    const { ctx } = this;
    for (const b of this.bursts) {
      if (b.kind === 'ring') {
        if (b.delay > 0) continue;
        ctx.globalAlpha = b.life * 0.8;
        ctx.strokeStyle = '#e6f0ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r, b.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = clamp(b.life * 1.5);
      ctx.fillStyle = b.color;
      if (b.kind === 'flake') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        const s = b.size;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const r = i % 2 ? s * 0.3 : s;
          const a = (i * Math.PI) / 4;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- procedural assets ----------

function makeHill(seed) {
  const rng = mulberry32(seed);
  const waves = Array.from({ length: 5 }, () => ({ f: 0.6 + rng() * 4, a: rng(), ph: rng() * Math.PI * 2 }));
  const total = waves.reduce((s, w) => s + w.a, 0);
  return (x) => waves.reduce((s, w) => s + w.a * Math.sin(Math.PI * 2 * w.f * x + w.ph), 0) / total;
}

function makeCloudSprites(n) {
  const sprites = [];
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(100 + i * 17);
    const W = 420;
    const H = 220;
    const puffs = [];
    const count = 7 + Math.floor(rng() * 7);
    for (let j = 0; j < count; j++) {
      const t = j / (count - 1);
      const hump = Math.sin(Math.PI * t);
      const r = 26 + rng() * 34 + hump * 40;
      puffs.push({
        x: 70 + t * 280 + (rng() - 0.5) * 30,
        y: 160 - r * 0.6 - rng() * 22 * hump,
        r,
      });
    }
    sprites.push({
      w: W,
      h: H,
      light: paintCloud(puffs, W, H, ['#ffffff', '#eef3fa', 'rgba(150,162,185,1)']),
      dark: paintCloud(puffs, W, H, ['#727a8a', '#575f6e', 'rgba(30,34,44,1)']),
    });
  }
  return sprites;
}

function paintCloud(puffs, W, H, [c0, c1, shade]) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.filter = 'blur(1.5px)';
  for (const p of puffs) {
    const grd = g.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r);
    grd.addColorStop(0, c0);
    grd.addColorStop(1, c1);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    g.fill();
  }
  g.filter = 'none';
  // Shade the underside
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, 70, 0, 175);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, shade);
  g.globalAlpha = 0.55;
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H);
  // Flatten and soften the base
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  const cut = g.createLinearGradient(0, 150, 0, 178);
  cut.addColorStop(0, 'rgba(0,0,0,0)');
  cut.addColorStop(1, 'rgba(0,0,0,1)');
  g.fillStyle = cut;
  g.fillRect(0, 150, W, H - 150);
  return c;
}
