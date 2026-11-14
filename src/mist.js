// A misted-up window over the sky on rainy or foggy days. Draw on it with a
// finger or the mouse; your drawing slowly mists over again and drips a little.

const SCALE = 0.5; // render at half resolution: it's blurry mist anyway

export class Mist {
  constructor(canvas, { onFirstShow } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mask = document.createElement('canvas');
    this.mctx = this.mask.getContext('2d');
    this.level = 0;
    this.target = 0;
    this.drips = [];
    this.last = null;
    this.running = false;
    this.onFirstShow = onFirstShow;
    this.shown = false;
    this.pattern = this.makePattern();

    this.resize();
    addEventListener('resize', () => this.resize());

    canvas.addEventListener('pointerdown', (e) => {
      this.drawing = true;
      this.last = this.toLocal(e);
      this.wipe(this.last, this.last);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.drawing) return;
      const pt = this.toLocal(e);
      this.wipe(this.last, pt);
      this.last = pt;
    });
    const end = () => (this.drawing = false);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  toLocal(e) {
    return { x: e.clientX * SCALE, y: e.clientY * SCALE };
  }

  resize() {
    const w = Math.ceil(innerWidth * SCALE);
    const h = Math.ceil(innerHeight * SCALE);
    // keep what was drawn when the size changes
    const old = document.createElement('canvas');
    old.width = this.mask.width;
    old.height = this.mask.height;
    if (old.width) old.getContext('2d').drawImage(this.mask, 0, 0);
    this.canvas.width = this.mask.width = w;
    this.canvas.height = this.mask.height = h;
    if (old.width) this.mctx.drawImage(old, 0, 0, w, h);
  }

  makePattern() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const r = 0.6 + Math.random() * 1.6;
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    return this.ctx.createPattern(c, 'repeat');
  }

  wipe(a, b) {
    const m = this.mctx;
    m.globalCompositeOperation = 'source-over';
    m.strokeStyle = '#000';
    m.lineCap = 'round';
    m.lineJoin = 'round';
    m.lineWidth = 15;
    m.beginPath();
    m.moveTo(a.x, a.y);
    m.lineTo(b.x, b.y);
    m.stroke();
    if (Math.random() < 0.08) this.drips.push({ x: b.x + (Math.random() - 0.5) * 8, y: b.y + 6, life: 1, v: 8 + Math.random() * 18 });
  }

  /** 0..1 — how misty the window should be. */
  setLevel(v) {
    this.target = v;
    if (v > 0.02 && !this.running) this.start();
    if (v > 0.3 && !this.shown) {
      this.shown = true;
      this.onFirstShow?.();
    }
  }

  start() {
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.level += (this.target - this.level) * Math.min(1, dt * 1.2);
      this.frame(dt);
      if (this.level < 0.01 && this.target < 0.01) {
        this.running = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.classList.remove('active');
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    const { ctx, mctx, canvas, mask } = this;
    this.canvas.classList.toggle('active', this.level > 0.15);

    // Drips run down from the drawing
    mctx.globalCompositeOperation = 'source-over';
    mctx.strokeStyle = '#000';
    mctx.lineWidth = 2.5;
    for (const d of this.drips) {
      mctx.beginPath();
      mctx.moveTo(d.x, d.y);
      d.y += d.v * dt;
      d.x += (Math.random() - 0.5) * 0.6;
      mctx.lineTo(d.x, d.y);
      mctx.stroke();
      d.life -= dt / 2.5;
    }
    this.drips = this.drips.filter((d) => d.life > 0);

    // Slowly mist over again
    mctx.globalCompositeOperation = 'destination-out';
    mctx.fillStyle = `rgba(0,0,0,${Math.min(1, dt * 0.09)})`;
    mctx.fillRect(0, 0, mask.width, mask.height);

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const a = this.level;
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, `rgba(215,225,238,${0.38 * a})`);
    g.addColorStop(1, `rgba(225,232,242,${0.55 * a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.pattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  clear() {
    this.mctx.clearRect(0, 0, this.mask.width, this.mask.height);
  }
}
