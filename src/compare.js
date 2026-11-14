// Split-screen comparison: your city's sky on the left, another city's on the right.
import { Scene } from './scene.js';
import { fetchForecast, searchCities, describe, weatherToScene, heatFor } from './weather.js';
import { skyAt } from './astro.js';
import { moodFor } from './mood.js';
import { CITIES } from './cities.js';

const $ = (id) => document.getElementById(id);

export class Compare {
  constructor({ reducedMotion, getMain, fmtT }) {
    this.getMain = getMain;
    this.fmtT = fmtT;
    this.reducedMotion = reducedMotion;
    this.el = $('compare');
    this.canvas = $('sky2');
    this.scene = null;
    this.split = 50;
    this.other = null;

    $('cmpClose').addEventListener('click', () => this.close());
    $('cmpChange').addEventListener('click', () => this.showSearch(true));
    this.canvas.addEventListener('pointerdown', (e) => this.scene?.burst(e.clientX, e.clientY));
    this.setupDivider();
    this.setupSearch();
  }

  get isOpen() {
    return !this.el.hidden;
  }

  open() {
    this.el.hidden = false;
    document.body.classList.add('comparing');
    if (!this.scene) this.scene = new Scene(this.canvas, { reducedMotion: this.reducedMotion });
    this.scene.start();
    this.setSplit(50);
    this.renderLeft();
    if (this.other) this.renderRight();
    else this.showSearch(true);
  }

  close() {
    this.el.hidden = true;
    document.body.classList.remove('comparing');
    this.scene?.stop();
  }

  /** Called when the main city changes while comparing. */
  refresh() {
    if (this.isOpen) this.renderLeft();
  }

  summary(loc, current) {
    const info = describe(current.code, current.isDay);
    const mood = moodFor({
      kind: info.kind,
      temp: current.temp,
      night: !current.isDay,
      wind: current.wind,
      seed: Math.floor(Date.now() / 3.6e6) + loc.name.length,
    });
    return `
      <div class="cmp-name">${escapeHtml(loc.name)}</div>
      <div class="cmp-temp">${this.fmtT(current.temp)}</div>
      <div class="cmp-cond">${info.emoji} ${info.label}</div>
      <div class="cmp-mood">${mood}</div>`;
  }

  renderLeft() {
    const { loc, data } = this.getMain();
    $('cmpLeft').innerHTML = data ? this.summary(loc, data.current) : `<div class="cmp-name">${escapeHtml(loc?.name || '')}</div>`;
  }

  renderRight() {
    const { loc, data } = this.other;
    $('cmpInfo').innerHTML = this.summary(loc, data.current);
    const sc = weatherToScene(data.current);
    const sky = skyAt(new Date(), loc.lat, loc.lon);
    this.scene.setTarget({ ...sc, ...sky, temp: data.current.temp, heat: heatFor(data.current.temp, sc, sky.sunAlt) });
  }

  async choose(loc) {
    $('cmpInfo').innerHTML = `<div class="cmp-name">${escapeHtml(loc.name)}</div><div class="cmp-cond">Fetching the sky…</div>`;
    this.showSearch(false);
    try {
      const data = await fetchForecast(loc.lat, loc.lon);
      this.other = { loc, data };
      this.renderRight();
    } catch {
      $('cmpInfo').innerHTML = `<div class="cmp-cond">Couldn’t load ${escapeHtml(loc.name)}. Try another city.</div>`;
      this.showSearch(true);
    }
  }

  showSearch(show) {
    $('cmpSearch').hidden = !show;
    $('cmpChange').hidden = show || !this.other;
    if (!show) return;
    const input = $('cmpInput');
    input.value = '';
    $('cmpResults').innerHTML = '';
    // A few random quick picks
    const picks = [...CITIES].sort(() => Math.random() - 0.5).slice(0, 4);
    const box = $('cmpPicks');
    box.innerHTML = '';
    for (const c of picks) {
      const b = document.createElement('button');
      b.className = 'pill small';
      b.textContent = c.name;
      b.addEventListener('click', () => this.choose({ name: `${c.name}, ${c.country}`, lat: c.lat, lon: c.lon }));
      box.appendChild(b);
    }
    if (matchMedia('(pointer: fine)').matches) input.focus();
  }

  setupSearch() {
    const input = $('cmpInput');
    const results = $('cmpResults');
    let timer;
    let seq = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) {
        results.innerHTML = '';
        return;
      }
      timer = setTimeout(async () => {
        const my = ++seq;
        try {
          const found = await searchCities(q);
          if (my !== seq) return;
          results.innerHTML = found.length ? '' : '<li class="empty">No places found.</li>';
          for (const r of found) {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.textContent = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
            b.addEventListener('click', () =>
              this.choose({ name: [r.name, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude })
            );
            li.appendChild(b);
            results.appendChild(li);
          }
        } catch {
          if (my === seq) results.innerHTML = '<li class="empty">Search is unavailable right now.</li>';
        }
      }, 250);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') results.querySelector('button')?.click();
    });
  }

  setSplit(pct) {
    this.split = Math.min(95, Math.max(5, pct));
    this.canvas.style.clipPath = `inset(0 0 0 ${this.split}%)`;
    const d = $('cmpDivider');
    d.style.left = `${this.split}%`;
    d.setAttribute('aria-valuenow', Math.round(this.split));
  }

  setupDivider() {
    const d = $('cmpDivider');
    let dragging = false;
    d.addEventListener('pointerdown', (e) => {
      dragging = true;
      d.setPointerCapture(e.pointerId);
    });
    d.addEventListener('pointermove', (e) => dragging && this.setSplit((e.clientX / innerWidth) * 100));
    d.addEventListener('pointerup', () => (dragging = false));
    d.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.setSplit(this.split - 5);
      if (e.key === 'ArrowRight') this.setSplit(this.split + 5);
    });
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
