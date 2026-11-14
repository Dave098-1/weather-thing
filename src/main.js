import { Scene } from './scene.js';
import { fetchForecast, searchCities, describe, weatherToScene } from './weather.js';
import { sunPosition, moonPosition, moonIllumination, toDeg } from './astro.js';
import { Soundscape } from './audio.js';
import { moodFor } from './mood.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: fine */
    }
  },
};

const LONDON = { name: 'London, United Kingdom', lat: 51.5085, lon: -0.1257 };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const WEATHER_PRESETS = {
  Clear: { rain: 0, snow: 0, storm: 0, fog: 0, cloud: 0.05, wind: 8 },
  Clouds: { rain: 0, snow: 0, storm: 0, fog: 0, cloud: 0.85, wind: 15 },
  Rain: { rain: 0.55, snow: 0, storm: 0, fog: 0, cloud: 0.9, wind: 15 },
  Downpour: { rain: 1, snow: 0, storm: 0, fog: 0, cloud: 1, wind: 30 },
  Snow: { rain: 0, snow: 0.8, storm: 0, fog: 0, cloud: 0.85, wind: 8 },
  Storm: { rain: 0.9, snow: 0, storm: 1, fog: 0, cloud: 1, wind: 45 },
  Fog: { rain: 0, snow: 0, storm: 0, fog: 0.9, cloud: 0.5, wind: 4 },
  Windy: { rain: 0, snow: 0, storm: 0, fog: 0, cloud: 0.4, wind: 55, windDir: 270 },
};

const TIME_PRESETS = {
  Dawn: { sunAlt: 2, sunAz: -1.3, moonAlt: -20 },
  Noon: { sunAlt: 55, sunAz: 0, moonAlt: -20 },
  Sunset: { sunAlt: 1, sunAz: 1.3, moonAlt: -20 },
  Night: { sunAlt: -30, sunAz: 0, moonAlt: 40, moonAz: 0.6 },
};

const state = {
  loc: null,
  data: null,
  offset: 0,
  unit: store.get('unit') || (/^(en-US|en-LR|my)/.test(navigator.language || '') ? 'F' : 'C'),
  override: { weather: null, time: null },
  playTimer: null,
};

// ---------- scene & sound ----------

const scene = new Scene($('sky'), { reducedMotion });
const sound = new Soundscape();

scene.onStrike = (closeness) => {
  sound.thunder(closeness);
  if (!reducedMotion && closeness > 0.55) {
    document.body.classList.remove('shake');
    void document.body.offsetWidth; // restart animation
    document.body.classList.add('shake');
  }
};
scene.start();

$('sky').addEventListener('pointerdown', (e) => scene.burst(e.clientX, e.clientY));

// ---------- formatting ----------

const toUnit = (c) => (state.unit === 'F' ? (c * 9) / 5 + 32 : c);
const fmtT = (c) => `${Math.round(toUnit(c))}°`;
const fmtWind = (kmh) => (state.unit === 'F' ? `${Math.round(kmh * 0.621371)} mph` : `${Math.round(kmh)} km/h`);
const fmtPrecip = (mm) => (state.unit === 'F' ? `${(mm / 25.4).toFixed(2)} in/h` : `${mm.toFixed(1)} mm/h`);
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (deg) => COMPASS[Math.round(deg / 22.5) % 16];

function fmtTime(sec, opts) {
  const date = new Date(sec * 1000);
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: state.data?.timezone, ...opts }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(date);
  }
}

// ---------- data access ----------

function currentIndex() {
  const now = Date.now() / 1000;
  const h = state.data.hourly;
  const next = h.findIndex((x) => x.time > now);
  if (next === -1) return h.length - 1;
  return Math.max(0, next - 1);
}

function sliceAt(offset) {
  const d = state.data;
  const i = Math.min(currentIndex() + offset, d.hourly.length - 1);
  const hour = d.hourly[i];
  if (offset === 0) return { ...hour, ...d.current, time: Date.now() / 1000 };
  return hour;
}

function dayFor(sec) {
  const days = state.data.daily;
  let best = days[0];
  for (const d of days) if (d.time <= sec) best = d;
  return best;
}

// ---------- scene targeting ----------

function astroFor(date) {
  const { lat, lon } = state.loc;
  const sun = sunPosition(date, lat, lon);
  const moon = moonPosition(date, lat, lon);
  return {
    sunAlt: toDeg(sun.altitude),
    sunAz: sun.azimuth,
    moonAlt: toDeg(moon.altitude),
    moonAz: moon.azimuth,
    moonPhase: moonIllumination(date).phase,
  };
}

function updateScene() {
  if (!state.loc) return;
  let target;
  if (state.data) {
    const s = sliceAt(state.offset);
    target = { ...weatherToScene(s), ...astroFor(new Date(s.time * 1000)), temp: s.temp };
  } else {
    target = astroFor(new Date());
  }
  if (state.override.weather) Object.assign(target, WEATHER_PRESETS[state.override.weather]);
  if (state.override.time) Object.assign(target, TIME_PRESETS[state.override.time]);
  scene.setTarget(target);
}

// ---------- UI ----------

let lastMood = '';

function tweenNumber(el, to) {
  const from = el._value ?? to;
  el._value = to;
  if (reducedMotion || from === to) {
    el.textContent = Math.round(to);
    return;
  }
  const start = performance.now();
  cancelAnimationFrame(el._raf);
  const step = (now) => {
    const t = Math.min(1, (now - start) / 700);
    const e = 1 - (1 - t) ** 3;
    el.textContent = Math.round(from + (to - from) * e);
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

function updateUI() {
  const d = state.data;
  if (!d) return;
  const s = sliceAt(state.offset);
  const info = describe(s.code, s.isDay);
  const day = dayFor(s.time);

  tweenNumber($('temp'), toUnit(s.temp));
  $('cond').textContent = `${info.emoji} ${info.label}`;

  const seed = Math.floor(s.time / 3600) + (state.loc?.name.length || 0);
  const mood = moodFor({ kind: info.kind, temp: s.temp, night: !s.isDay, wind: s.wind, seed });
  if (mood !== lastMood) {
    const el = $('mood');
    el.textContent = mood;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    lastMood = mood;
  }
  $('hilo').textContent = `H ${fmtT(day.max)} · L ${fmtT(day.min)} · Feels like ${fmtT(s.feels)}`;

  // Stat cards
  $('windSpeed').textContent = fmtWind(s.wind);
  $('windDir').textContent = `from the ${compass(s.windDir)}`;
  vane.target = s.windDir + 180; // arrow points where the wind is going
  vane.wind = s.wind;
  $('humidity').textContent = `${Math.round(s.humidity)}%`;
  $('humBar').style.width = `${clamp(s.humidity, 0, 100)}%`;
  $('pop').textContent = `${Math.round(s.pop ?? 0)}%`;
  $('precip').textContent = s.precip > 0 ? fmtPrecip(s.precip) : 'Dry right now';
  if (state.offset > 0) $('precip').textContent = s.precip > 0 ? fmtPrecip(s.precip) : 'Looks dry';

  const rise = day.sunrise;
  const set = day.sunset;
  const f = (s.time - rise) / (set - rise);
  const dot = $('sunDot');
  if (f >= 0 && f <= 1) {
    const a = Math.PI * (1 - f);
    dot.setAttribute('cx', (60 + 50 * Math.cos(a)).toFixed(1));
    dot.setAttribute('cy', (58 - 50 * Math.sin(a)).toFixed(1));
    dot.style.opacity = 1;
  } else {
    dot.setAttribute('cx', f < 0 ? 10 : 110);
    dot.setAttribute('cy', 58);
    dot.style.opacity = 0.35;
  }
  const tf = { hour: 'numeric', minute: '2-digit' };
  $('sunTimes').textContent = `↑ ${fmtTime(rise, tf)} · ↓ ${fmtTime(set, tf)}`;
  $('uv').textContent = s.isDay ? `UV ${Math.round(s.uv ?? 0)}` : '';

  // Scrubber
  $('scrubLabel').textContent =
    state.offset === 0 ? 'Now' : `In ${state.offset}h · ${fmtTime(s.time, { weekday: 'short', hour: 'numeric' })}`;
  $('nowBtn').hidden = state.offset === 0;
  const x = (state.offset / 24) * 100;
  $('marker').style.left = `${x}%`;
  $('markerDot').style.top = `${chartY(s.temp)}%`;

  updateChip();
}

function updateChip() {
  const chip = $('chip');
  const parts = [];
  if (state.offset > 0) parts.push(`Forecast for ${fmtTime(sliceAt(state.offset).time, { hour: 'numeric' })}`);
  const ov = [state.override.weather, state.override.time].filter(Boolean);
  if (ov.length) parts.push(`🎛️ Previewing ${ov.join(' + ')}`);
  chip.hidden = !parts.length;
  chip.textContent = parts.join(' · ');
}

// ---------- 24h chart ----------

let chartRange = { min: 0, max: 1 };
const CHART_TOP = 44;
const CHART_BOTTOM = 86;
const chartY = (t) =>
  CHART_BOTTOM - ((t - chartRange.min) / (chartRange.max - chartRange.min || 1)) * (CHART_BOTTOM - CHART_TOP);

function renderChart() {
  const pts = Array.from({ length: 25 }, (_, k) => sliceAt(k));
  const temps = pts.map((p) => p.temp);
  chartRange = { min: Math.min(...temps), max: Math.max(...temps) };
  const X = (k) => (k / 24) * 600;

  // Smooth line via Catmull-Rom → Bézier
  const xy = pts.map((p, k) => [X(k), chartY(p.temp)]);
  let line = `M${xy[0][0]},${xy[0][1]}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] || xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C${c1},${c2},${p2}`;
  }
  const bars = pts
    .map((p, k) => {
      const h = ((p.pop ?? 0) / 100) * 34;
      return h > 0.5 ? `<rect x="${X(k) - 6}" y="${100 - h}" width="12" height="${h}" rx="3" />` : '';
    })
    .join('');

  $('chart').innerHTML = `
    <defs>
      <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd36b" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#ffd36b" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g fill="rgba(130,190,255,0.45)">${bars}</g>
    <path d="${line} L600,100 L0,100 Z" fill="url(#area)" />
    <path d="${line}" fill="none" stroke="#fff" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="round" />`;

  let overlay = '';
  for (let k = 0; k <= 24; k += 3) {
    const p = pts[k];
    const left = (k / 24) * 100;
    const minor = k % 6 ? ' minor' : '';
    overlay += `<span class="ico${minor}" style="left:${left}%">${describe(p.code, p.isDay).emoji}</span>`;
    overlay += `<span class="t${minor}" style="left:${left}%;top:calc(${chartY(p.temp)}% - 22px)">${fmtT(p.temp)}</span>`;
  }
  $('chartOverlay').innerHTML = overlay;

  let ticks = '';
  for (let k = 0; k <= 24; k += 6) {
    const label = k === 0 ? 'Now' : fmtTime(pts[k].time, { hour: 'numeric' });
    ticks += `<span style="left:${(k / 24) * 100}%">${label}</span>`;
  }
  $('ticks').innerHTML = ticks;
}

// ---------- weathervane spring + per-frame UI ----------

const vane = { angle: 0, vel: 0, target: 0, wind: 0 };
let snowCap = 0;
let lastFrame = performance.now();

function uiLoop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const diff = ((((vane.target - vane.angle + 180) % 360) + 360) % 360) - 180;
  vane.vel += (diff * 40 - vane.vel * 4) * dt; // bouncy spring
  vane.angle += vane.vel * dt;
  const jitter = reducedMotion ? 0 : Math.sin(now / 180) * Math.min(vane.wind, 60) * 0.06;
  $('vaneArrow').setAttribute('transform', `rotate(${(vane.angle + jitter).toFixed(2)} 32 32)`);

  const snowing = scene.p.snow > 0.25;
  snowCap = clamp(snowCap + (snowing ? dt * 2.5 * scene.p.snow : -dt * 4), 0, 14);
  document.documentElement.style.setProperty('--snow', `${snowCap.toFixed(2)}px`);

  document.getElementById('app').classList.toggle('gusty', scene.p.wind > 40);
  sound.update(scene.p, scene.dayF, dt);
  requestAnimationFrame(uiLoop);
}
requestAnimationFrame(uiLoop);

// ---------- loading ----------

let toastTimer;
function toast(msg, ms = 4500) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}

async function load() {
  if (!state.loc) return;
  try {
    const data = await fetchForecast(state.loc.lat, state.loc.lon);
    state.data = data;
    state.offset = Math.min(state.offset, 24);
    renderChart();
    updateUI();
    updateScene();
  } catch (err) {
    console.error(err);
    if (!state.data) $('cond').textContent = 'Couldn’t reach the weather service.';
    toast('Couldn’t load the weather. Check your connection and try again.');
    updateScene();
  }
}

function setLocation(loc) {
  state.loc = loc;
  store.set('loc', loc);
  $('locName').textContent = loc.name;
  stopPlaying();
  state.offset = 0;
  $('scrub').value = 0;
  updateScene();
  load();
}

function locate(onFail) {
  if (!('geolocation' in navigator)) {
    onFail?.();
    return;
  }
  $('locName').textContent = 'Finding you…';
  navigator.geolocation.getCurrentPosition(
    (pos) => setLocation({ name: 'Your location', lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => {
      toast('Couldn’t get your location. Search for a city instead.');
      onFail?.();
    },
    { timeout: 10000, maximumAge: 10 * 60 * 1000 }
  );
}

// ---------- city search ----------

const searchBox = $('searchBox');
const searchInput = $('searchInput');
const results = $('searchResults');

function openSearch(open) {
  searchBox.hidden = !open;
  $('locBtn').setAttribute('aria-expanded', String(open));
  if (open) {
    searchInput.value = '';
    results.innerHTML = '';
    searchInput.focus();
  }
}

$('locBtn').addEventListener('click', () => openSearch(searchBox.hidden));
$('geoBtn').addEventListener('click', () => {
  openSearch(false);
  locate(() => state.loc && ($('locName').textContent = state.loc.name));
});

let searchTimer;
let searchSeq = 0;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    results.innerHTML = '';
    return;
  }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    try {
      const found = await searchCities(q);
      if (seq !== searchSeq) return;
      results.innerHTML = '';
      if (!found.length) {
        results.innerHTML = '<li class="empty">No places found.</li>';
        return;
      }
      for (const r of found) {
        const li = document.createElement('li');
        const b = document.createElement('button');
        const region = [r.admin1, r.country].filter(Boolean).join(', ');
        b.innerHTML = `<span></span> <small></small>`;
        b.querySelector('span').textContent = r.name;
        b.querySelector('small').textContent = region;
        b.addEventListener('click', () => {
          openSearch(false);
          setLocation({ name: [r.name, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude });
        });
        li.appendChild(b);
        results.appendChild(li);
      }
    } catch {
      if (seq === searchSeq) results.innerHTML = '<li class="empty">Search is unavailable right now.</li>';
    }
  }, 250);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') results.querySelector('button')?.click();
});

document.addEventListener('pointerdown', (e) => {
  if (!searchBox.hidden && !e.target.closest('.loc-wrap')) openSearch(false);
});

// ---------- controls ----------

function setUnitLabel() {
  $('unitBtn').textContent = state.unit === 'F' ? '°F' : '°C';
}
setUnitLabel();

$('unitBtn').addEventListener('click', () => {
  state.unit = state.unit === 'F' ? 'C' : 'F';
  store.set('unit', state.unit);
  setUnitLabel();
  $('temp')._value = undefined;
  if (state.data) {
    renderChart();
    updateUI();
  }
});

$('soundBtn').addEventListener('click', async () => {
  const btn = $('soundBtn');
  if (sound.on) {
    sound.disable();
    btn.textContent = '🔇';
    btn.setAttribute('aria-pressed', 'false');
  } else {
    try {
      await sound.enable();
      btn.textContent = '🔊';
      btn.setAttribute('aria-pressed', 'true');
    } catch {
      toast('Sound isn’t available in this browser.');
    }
  }
});

$('scrub').addEventListener('input', (e) => {
  stopPlaying();
  setOffset(Number(e.target.value));
});

function setOffset(o) {
  state.offset = o;
  $('scrub').value = o;
  updateUI();
  updateScene();
}

$('nowBtn').addEventListener('click', () => {
  stopPlaying();
  setOffset(0);
});

function stopPlaying() {
  if (state.playTimer) clearInterval(state.playTimer);
  state.playTimer = null;
  $('playBtn').textContent = '▶ Play the day';
}

$('playBtn').addEventListener('click', () => {
  if (!state.data) return;
  if (state.playTimer) {
    stopPlaying();
    return;
  }
  if (state.offset >= 24) setOffset(0);
  $('playBtn').textContent = '⏸ Pause';
  state.playTimer = setInterval(() => {
    if (state.offset >= 24) {
      stopPlaying();
      setTimeout(() => !state.playTimer && setOffset(0), 1500);
      return;
    }
    setOffset(state.offset + 1);
  }, 600);
});

// ---------- effects lab ----------

function buildLab() {
  const make = (container, presets, key) => {
    const options = ['Live', ...Object.keys(presets)];
    for (const name of options) {
      const b = document.createElement('button');
      b.textContent = name;
      b.dataset.name = name;
      b.addEventListener('click', () => {
        state.override[key] = name === 'Live' ? null : name;
        refreshLab();
        updateScene();
        updateChip();
      });
      container.appendChild(b);
    }
  };
  make($('labWeather'), WEATHER_PRESETS, 'weather');
  make($('labTime'), TIME_PRESETS, 'time');
  refreshLab();
}

function refreshLab() {
  for (const [id, key] of [
    ['labWeather', 'weather'],
    ['labTime', 'time'],
  ]) {
    for (const b of $(id).children) {
      const active = (state.override[key] ?? 'Live') === b.dataset.name;
      b.classList.toggle('active', active);
    }
  }
}

function toggleLab(open = $('lab').hidden) {
  $('lab').hidden = !open;
  $('labBtn').setAttribute('aria-pressed', String(open));
}

buildLab();
$('labBtn').addEventListener('click', () => toggleLab());
$('labClose').addEventListener('click', () => toggleLab(false));

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input') && e.target.type !== 'range') {
    if (e.key === 'Escape') openSearch(false);
    return;
  }
  if (e.key === 'd' || e.key === 'D') toggleLab();
  if (e.key === 'Escape') {
    toggleLab(false);
    openSearch(false);
  }
});

// ---------- start ----------

const saved = store.get('loc');
if (saved && typeof saved.lat === 'number') setLocation(saved);
else locate(() => setLocation(LONDON));

setInterval(load, 15 * 60 * 1000); // refresh data
setInterval(() => state.offset === 0 && (updateScene(), state.data && updateUI()), 60 * 1000); // keep the sun moving
