// "Catch the rain": move Puff left and right to catch falling drops for 30 seconds.
// The falling things match the weather (raindrops, snowflakes or stars).

const ROUND = 30;

export class CatchGame {
  constructor({ el, canvas, getTheme, getPuffImage, onEnd, reducedMotion }) {
    this.el = el;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getTheme = getTheme;
    this.getPuffImage = getPuffImage;
    this.onEnd = onEnd;
    this.reduced = reducedMotion;
    this.running = false;
    this.keys = {};

    canvas.addEventListener('pointermove', (e) => (this.aim = e.clientX));
    canvas.addEventListener('pointerdown', (e) => (this.aim = e.clientX));
    addEventListener('keydown', (e) => {
      if (this.el.hidden) return;
      this.keys[e.key] = true;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.aim = null;
        e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => (this.keys[e.key] = false));
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.size = Math.max(26, Math.min(42, Math.min(this.w, this.h) * 0.05));
  }

  async open() {
    this.el.hidden = false;
    document.body.classList.add('gaming');
    this.resize();
    this.theme = this.getTheme();
    this.puff = await this.getPuffImage().catch(() => null);
    this.showPanel(
      `${this.theme.title}`,
      `Move Puff to catch ${this.theme.name}. ${this.theme.bonus} is worth 5, but dodge the ⚡!`,
      'Start',
      () => this.start()
    );
    this.x = this.w / 2;
    this.drawIdle();
  }

  close() {
    this.running = false;
    this.el.hidden = true;
    document.body.classList.remove('gaming');
  }

  showPanel(title, text, button, action) {
    const panel = this.el.querySelector('.game-panel');
    panel.hidden = false;
    panel.querySelector('h2').textContent = title;
    panel.querySelector('p').textContent = text;
    const btn = panel.querySelector('.game-go');
    btn.textContent = button;
    btn.onclick = action;
    btn.focus();
  }

  start() {
    this.el.querySelector('.game-panel').hidden = true;
    this.score = 0;
    this.timeLeft = ROUND;
    this.items = [];
    this.pops = [];
    this.spawnT = 0;
    this.flash = 0;
    this.wobble = 0;
    this.running = true;
    let last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.draw();
      if (this.timeLeft <= 0) return this.finish();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.timeLeft -= dt;
    const elapsed = ROUND - this.timeLeft;
    // Puff follows the pointer or the arrow keys
    const speed = this.w * 1.1;
    if (this.keys.ArrowLeft) this.x -= speed * dt;
    if (this.keys.ArrowRight) this.x += speed * dt;
    if (this.aim != null) this.x += (this.aim - this.x) * Math.min(1, dt * 14);
    this.x = Math.max(40, Math.min(this.w - 40, this.x));

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(0.22, 0.6 - elapsed * 0.013);
      const r = Math.random();
      const kind = r < 0.06 ? 'gold' : r < 0.17 ? 'bad' : 'good';
      this.items.push({
        x: 30 + Math.random() * (this.w - 60),
        y: -40,
        v: (150 + Math.random() * 120 + elapsed * 7) * (this.h / 800),
        kind,
        rot: Math.random() * 6,
      });
    }

    const catchY = this.h - this.puffH() - 10;
    for (const it of this.items) {
      it.y += it.v * dt;
      it.rot += dt * 2;
      if (!it.done && it.y > catchY - 10 && it.y < catchY + 30 && Math.abs(it.x - this.x) < this.size * 1.6) {
        it.done = true;
        const pts = it.kind === 'gold' ? 5 : it.kind === 'bad' ? -3 : 1;
        this.score = Math.max(0, this.score + pts);
        this.pops.push({ x: it.x, y: catchY - 20, text: pts > 0 ? `+${pts}` : `${pts}`, life: 1, bad: pts < 0 });
        if (pts < 0) {
          this.flash = 1;
          this.wobble = 1;
        }
      }
    }
    this.items = this.items.filter((it) => !it.done && it.y < this.h + 40);
    for (const p of this.pops) {
      p.y -= 60 * dt;
      p.life -= dt / 0.9;
    }
    this.pops = this.pops.filter((p) => p.life > 0);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.wobble = Math.max(0, this.wobble - dt * 2.5);
    this.el.querySelector('.g-score').textContent = this.score;
    this.el.querySelector('.g-time').textContent = Math.ceil(Math.max(0, this.timeLeft));
  }

  puffH() {
    return Math.min(150, this.h * 0.17);
  }

  drawPuff() {
    const { ctx } = this;
    const ph = this.puffH();
    const pw = ph * 0.8;
    const shake = this.reduced ? 0 : Math.sin(performance.now() / 30) * this.wobble * 8;
    const x = this.x + shake;
    const y = this.h - ph - 6;
    if (this.puff) ctx.drawImage(this.puff, x - pw / 2, y, pw, ph);
    // the catching bowl
    const bw = this.size * 3;
    ctx.fillStyle = '#ffd36b';
    ctx.strokeStyle = '#e0a82e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y + ph * 0.06, bw / 2, bw * 0.28, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  drawItems() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const it of this.items) {
      const emoji = it.kind === 'gold' ? this.theme.bonus : it.kind === 'bad' ? '⚡' : this.theme.item;
      ctx.save();
      ctx.translate(it.x, it.y);
      if (it.kind !== 'good' || this.theme.item === '❄️' || this.theme.item === '⭐') ctx.rotate(Math.sin(it.rot) * 0.4);
      ctx.font = `${this.size * (it.kind === 'gold' ? 1.25 : 1)}px serif`;
      ctx.fillText(emoji, 0, 0);
      ctx.restore();
    }
    for (const p of this.pops) {
      ctx.globalAlpha = Math.min(1, p.life * 1.5);
      ctx.fillStyle = p.bad ? '#ff8a8a' : '#fff';
      ctx.font = `600 ${this.size * 0.8}px Fredoka, system-ui, sans-serif`;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  draw() {
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,80,80,${this.flash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }
    this.drawItems();
    this.drawPuff();
  }

  drawIdle() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.drawPuff();
  }

  finish() {
    this.running = false;
    const result = this.onEnd?.(this.score) || {};
    const lines = [`You caught ${this.score} point${this.score === 1 ? '' : 's'}!`];
    if (result.isBest) lines.push('🏆 New best score!');
    else lines.push(`Best: ${result.best ?? this.score}`);
    if (result.unlocked?.length) lines.push(`🎉 Unlocked for Puff: ${result.unlocked.map((i) => `${i.icon} ${i.name}`).join(', ')}`);
    this.showPanel("Time's up!", lines.join(' '), 'Play again', () => this.start());
  }
}

/** What falls depends on the sky. */
export function themeFor(p, nightF) {
  if (p.snow > 0.3) return { item: '❄️', name: 'snowflakes', bonus: '⛄', title: 'Catch the snow!' };
  if (nightF > 0.6 && p.rain < 0.2) return { item: '⭐', name: 'falling stars', bonus: '🌙', title: 'Catch the stars!' };
  return { item: '💧', name: 'raindrops', bonus: '🌈', title: 'Catch the rain!' };
}
