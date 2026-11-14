import { Scene } from './scene.js';
import { fetchForecast, searchCities, describe, weatherToScene, heatFor } from './weather.js';
import { skyAt, moonInfo, moonPathD } from './astro.js';
import { Soundscape } from './audio.js';
import { moodFor } from './mood.js';
import { Mascot } from './mascot.js';
import { renderDays } from './forecast.js';
import { Compare } from './compare.js';
import { clamp, hexToRgb, mixRgb, rgba } from './util.js';
import { Mist } from './mist.js';
import { tipsFor } from './tips.js';
import { fetchAir, aqiLevel, pollenLevel, hazeFor } from './air.js';
import { makeShareImage, shareOrDownload, mascotImage } from './share.js';
import { CatchGame, themeFor } from './game.js';
import { Wardrobe, ITEMS } from './wardrobe.js';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

// Running inside the iOS app (Capacitor) rather than a browser?
const isNative = Capacitor.isNativePlatform();
if (isNative) {
  document.documentElement.classList.add('native');
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {}); // white status-bar text
}

/** A little vibration in the iOS app; does nothing on the web. */
function buzz(kind = 'light') {
  if (!isNative) return;
  const run =
    kind === 'error'
      ? Haptics.notification({ type: NotificationType.Error })
      : kind === 'success'
        ? Haptics.notification({ type: NotificationType.Success })
        : Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
  run.catch(() => {});
}

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

const CALM = { rain: 0, snow: 0, storm: 0, fog: 0, heat: 0 };
const WEATHER_PRESETS = {
  Clear: { ...CALM, cloud: 0.05, wind: 8, temp: 20 },
  Clouds: { ...CALM, cloud: 0.85, wind: 15, temp: 14 },
  Rain: { ...CALM, rain: 0.55, cloud: 0.9, wind: 15, temp: 12 },
  Downpour: { ...CALM, rain: 1, cloud: 1, wind: 30, temp: 12 },
  Snow: { ...CALM, snow: 0.8, cloud: 0.85, wind: 8, temp: -2 },
  Storm: { ...CALM, rain: 0.9, storm: 1, cloud: 1, wind: 45, temp: 18 },
  Fog: { ...CALM, fog: 0.9, cloud: 0.5, wind: 4, temp: 8 },
  Windy: { ...CALM, cloud: 0.4, wind: 55, windDir: 270, temp: 15 },
  Heatwave: { ...CALM, heat: 1, cloud: 0.02, wind: 5, temp: 37 },
};

const EXTRA_PRESETS = {
  Rainbow: { rainbow: 1, rain: 0.12, snow: 0, storm: 0, fog: 0, cloud: 0.35, sunAlt: 16, sunAz: 1.1, moonAlt: -20 },
  Aurora: { aurora: 1, rain: 0, snow: 0, storm: 0, fog: 0, cloud: 0.05, sunAlt: -28, moonAlt: -20 },
  Autumn: { season: 1 },
  Blossom: { season: 2, rain: 0, snow: 0 },
  Fireworks: { fireworks: 1, rain: 0, snow: 0, storm: 0, fog: 0, cloud: 0.1, sunAlt: -25, moonAlt: -20 },
  Smog: { haze: 1, cloud: 0.3 },
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
  override: { weather: null, time: null, extra: null },
  air: null,
  favs: store.get('favs') || [],
  playTimer: null,
};

// ---------- scene & sound ----------

const scene = new Scene($('sky'), { reducedMotion });
const sound = new Soundscape();
const mascot = new Mascot($('mascot'));
$('mascot').addEventListener('click', () => buzz('light'));

scene.onStrike = (closeness) => {
  sound.thunder(closeness);
  if (closeness > 0.6) buzz('medium');
  if (!reducedMotion) {
    // The lightning lights up the glass cards too
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
  }
  if (!reducedMotion && closeness > 0.55) {
    document.body.classList.remove('shake');
    void document.body.offsetWidth; // restart animation
    document.body.classList.add('shake');
  }
};
scene.start();

// Sparkles on a tap, not when a finger lands on the sky to scroll the page
let skyPress = null;
$('sky').addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') scene.burst(e.clientX, e.clientY);
  else skyPress = { x: e.clientX, y: e.clientY, t: performance.now() };
});
$('sky').addEventListener('pointerup', (e) => {
  if (!skyPress) return;
  const tap = Math.hypot(e.clientX - skyPress.x, e.clientY - skyPress.y) < 10 && performance.now() - skyPress.t < 400;
  skyPress = null;
  if (tap) scene.burst(e.clientX, e.clientY);
});
$('sky').addEventListener('pointercancel', () => (skyPress = null));

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

function updateScene() {
  if (!state.loc) return;
  let target;
  if (state.data) {
    const s = sliceAt(state.offset);
    const sc = weatherToScene(s);
    const sky = skyAt(new Date(s.time * 1000), state.loc.lat, state.loc.lon);
    const prev = state.offset > 0 ? sliceAt(state.offset - 1) : state.data.hourly[Math.max(0, currentIndex() - 1)];
    target = {
      ...sc,
      ...sky,
      temp: s.temp,
      heat: heatFor(s.temp, sc, sky.sunAlt),
      rainbow: rainbowFor(sc, sky, prev),
      aurora: auroraFor(state.loc.lat, sky),
      haze: hazeFor(state.air),
      ...seasonFor(s.time, sky),
    };
  } else {
    target = { ...scene.target, ...skyAt(new Date(), state.loc.lat, state.loc.lon) };
  }
  if (state.override.weather) Object.assign(target, WEATHER_PRESETS[state.override.weather], { rainbow: 0, aurora: 0 });
  if (state.override.time) Object.assign(target, TIME_PRESETS[state.override.time]);
  if (state.override.extra) Object.assign(target, EXTRA_PRESETS[state.override.extra]);
  scene.setTarget(target);
  mascot.update({ ...scene.target, ...target });
  mist.setLevel(clamp(Math.max(target.rain * 1.2 - 0.1, target.fog * 0.9), 0, 0.9));
  if (state.data && state.offset === 0 && !state.override.weather && !state.override.time && !state.override.extra) {
    recordSightings(target);
  }
}

/** A rainbow: sun fairly low and not hidden, with light rain now or rain that just stopped. */
function rainbowFor(sc, sky, prev) {
  if (sky.sunAlt < 2 || sky.sunAlt > 42 || sc.cloud > 0.85 || sc.snow > 0 || sc.storm > 0.3) return 0;
  if (sc.rain > 0.05 && sc.rain < 0.5) return 0.8;
  if (sc.rain === 0 && (prev?.precip ?? 0) > 0.1) return 1;
  return 0;
}

/** Northern (and southern) lights on dark nights far from the equator. */
function auroraFor(lat, sky) {
  const a = Math.abs(lat);
  if (sky.sunAlt > -12 || a < 55) return 0;
  return a >= 62 ? 0.9 : 0.45;
}

/** Seasonal touches from the local date: autumn leaves, spring blossom, New Year fireworks. */
function seasonFor(sec, sky) {
  let month = 0;
  let day = 0;
  let hour = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: state.data.timezone,
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(new Date(sec * 1000));
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    month = get('month');
    day = get('day');
    hour = get('hour');
  } catch {
    const d = new Date(sec * 1000);
    month = d.getMonth() + 1;
    day = d.getDate();
    hour = d.getHours();
  }
  const south = state.loc.lat < 0;
  const autumn = south ? month >= 3 && month <= 5 : month >= 9 && month <= 11;
  const spring = south ? month >= 9 && month <= 11 : month >= 3 && month <= 5;
  const newYear = (month === 12 && day === 31 && hour >= 20) || (month === 1 && day === 1 && hour < 3);
  $('globeShakeBtn').hidden = !(month === 12 && day <= 26) && state.override.extra !== 'Snow globe';
  return { season: autumn ? 1 : spring ? 2 : 0, fireworks: newYear && sky.sunAlt < -6 ? 1 : 0 };
}

// ---------- UI ----------

let lastMood = '';

/** Count a number up/down to its new value (e.g. 12 → 18), then give it a little bump. */
function tweenValue(el, to, fmt = (v) => Math.round(v)) {
  const from = el._value ?? to;
  el._value = to;
  cancelAnimationFrame(el._raf);
  if (reducedMotion || from === to) {
    el.textContent = fmt(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 700);
    const e = 1 - (1 - t) ** 3;
    el.textContent = fmt(from + (to - from) * e);
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
  if (Math.round(from) !== Math.round(to)) bump(el);
}

function bump(el, cls = 'bump') {
  if (reducedMotion) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function updateUI() {
  const d = state.data;
  if (!d) return;
  const s = sliceAt(state.offset);
  const info = describe(s.code, s.isDay);
  const day = dayFor(s.time);

  tweenValue($('temp'), toUnit(s.temp));
  const condText = `${info.emoji} ${info.label}`;
  if ($('cond').textContent !== condText) {
    $('cond').textContent = condText;
    bump($('cond'), 'swap');
  }

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

  // Thermometer: -20 °C → empty, 40 °C → full
  thermo.target = clamp((s.feels + 20) / 60, 0.04, 1);
  $('thVal').textContent = fmtT(s.feels);
  $('thermo').style.color = thermoColor(s.feels);
  $('thermo').setAttribute('aria-label', `Feels like ${fmtT(s.feels)}`);

  // Stat cards
  tweenValue($('windSpeed'), s.wind, fmtWind);
  $('windDir').textContent = `from the ${compass(s.windDir)}`;
  vane.target = s.windDir + 180; // arrow points where the wind is going
  vane.wind = s.wind;
  tweenValue($('humidity'), s.humidity, (v) => `${Math.round(v)}%`);
  $('humBar').style.width = `${clamp(s.humidity, 0, 100)}%`;
  tweenValue($('pop'), s.pop ?? 0, (v) => `${Math.round(v)}%`);
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
// Temperature (line) and chance of rain (bars) use separate strips with their
// own scales, so the chart never implies a link between the two that isn't there.

let chartRange = { min: 0, max: 1 };
let chartPts = [];
const CHART_TOP = 46;
const CHART_BOTTOM = 90;
const chartY = (t) =>
  CHART_BOTTOM - ((t - chartRange.min) / (chartRange.max - chartRange.min || 1)) * (CHART_BOTTOM - CHART_TOP);

function renderChart() {
  const pts = Array.from({ length: 25 }, (_, k) => sliceAt(k));
  chartPts = pts;
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

  $('chart').innerHTML = `
    <defs>
      <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd36b" stop-opacity="0.45"/>
        <stop offset="1" stop-color="#ffd36b" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <line x1="0" y1="100" x2="600" y2="100" class="baseline" vector-effect="non-scaling-stroke" />
    <path class="area" d="${line} L600,100 L0,100 Z" fill="url(#area)" />
    <path class="line" d="${line}" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" />`;

  // Icons every 3 hours; direct temperature labels only where they matter: now, warmest, coldest.
  const iMax = temps.indexOf(chartRange.max);
  const iMin = temps.indexOf(chartRange.min);
  const labelled = [...new Set([0, iMax, iMin])];
  let overlay = '';
  for (let k = 0; k <= 24; k += 3) {
    const minor = k % 6 ? ' minor' : '';
    overlay += `<span class="ico${minor}" style="left:${(k / 24) * 100}%;--i:${k / 3}">${describe(pts[k].code, pts[k].isDay).emoji}</span>`;
  }
  for (const k of labelled) {
    overlay += `<span class="t" style="left:${clamp((k / 24) * 100, 3, 97)}%;top:calc(${chartY(pts[k].temp)}% - 21px)">${fmtT(pts[k].temp)}</span>`;
  }
  $('chartOverlay').innerHTML = overlay;

  // Rain-chance strip: thin bars, rounded tops anchored to the baseline.
  const pops = pts.map((p) => p.pop ?? 0);
  const iWet = pops.indexOf(Math.max(...pops));
  $('rainStrip').innerHTML = pops
    .map((v, k) => {
      const label = k === iWet && v >= 10 ? `<em>${Math.round(v)}%</em>` : '';
      return `<i style="left:${(k / 24) * 100}%;height:${Math.max(v, 2)}%;--i:${k}" class="${v < 1 ? 'zero' : ''}">${label}</i>`;
    })
    .join('');

  let ticks = '';
  for (let k = 0; k <= 24; k += 6) {
    const label = k === 0 ? 'Now' : fmtTime(pts[k].time, { hour: 'numeric' });
    ticks += `<span style="left:${(k / 24) * 100}%">${label}</span>`;
  }
  $('ticks').innerHTML = ticks;

  // Same numbers for screen readers
  const tbody = $('chartTable').querySelector('tbody');
  tbody.replaceChildren(
    ...pts.map((p, k) => {
      const tr = document.createElement('tr');
      const cells = [
        k === 0 ? 'Now' : fmtTime(p.time, { weekday: 'short', hour: 'numeric' }),
        fmtT(p.temp),
        `${Math.round(p.pop ?? 0)}%`,
        describe(p.code, p.isDay).label,
      ];
      for (const c of cells) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      return tr;
    })
  );

  bump($('chartArea'), 'drawn');
}

// Hover crosshair + tooltip (snaps to the nearest hour; click to jump there)
function showTip(k) {
  const p = chartPts[k];
  if (!p) return;
  const line = $('hoverLine');
  line.hidden = false;
  line.style.left = `calc(11px + (100% - 22px) * ${k / 24})`;
  const tip = $('tip');
  tip.replaceChildren();
  const strong = document.createElement('strong');
  strong.textContent = `${describe(p.code, p.isDay).emoji} ${fmtT(p.temp)}`;
  const rain = document.createElement('span');
  rain.textContent = `💧 ${Math.round(p.pop ?? 0)}% chance of rain`;
  const time = document.createElement('small');
  time.textContent = k === 0 ? 'Now' : fmtTime(p.time, { weekday: 'short', hour: 'numeric' });
  tip.append(strong, rain, time);
  tip.classList.toggle('flip', k > 14);
}

function hideTip() {
  $('hoverLine').hidden = true;
}

function hourAt(clientX) {
  const r = $('chartArea').getBoundingClientRect();
  return Math.round(clamp((clientX - r.left - 11) / (r.width - 22), 0, 1) * 24);
}

$('chartArea').addEventListener('pointermove', (e) => chartPts.length && showTip(hourAt(e.clientX)));
$('chartArea').addEventListener('pointerleave', hideTip);
// On touch screens the tooltip only shows while your finger is on the chart
for (const ev of ['pointerup', 'pointercancel']) {
  $('chartArea').addEventListener(ev, (e) => e.pointerType !== 'mouse' && setTimeout(hideTip, 1200));
}
addEventListener('scroll', () => document.activeElement !== $('scrub') && hideTip(), { passive: true });
$('chartArea').addEventListener('click', (e) => {
  if (!state.data) return;
  stopPlaying();
  setOffset(hourAt(e.clientX));
});
$('scrub').addEventListener('focus', () => chartPts.length && showTip(state.offset));
$('scrub').addEventListener('blur', hideTip);

// ---------- thermometer ----------

const THERMO_STOPS = [
  [-10, '#5aa9ff'],
  [5, '#6fd3c1'],
  [15, '#ffd36b'],
  [25, '#ff9a4a'],
  [35, '#ff4d4d'],
].map(([t, c]) => [t, hexToRgb(c)]);

function thermoColor(t) {
  if (t <= THERMO_STOPS[0][0]) return rgba(THERMO_STOPS[0][1]);
  for (let i = 1; i < THERMO_STOPS.length; i++) {
    const [t1, c1] = THERMO_STOPS[i];
    if (t <= t1) {
      const [t0, c0] = THERMO_STOPS[i - 1];
      return rgba(mixRgb(c0, c1, (t - t0) / (t1 - t0)));
    }
  }
  return rgba(THERMO_STOPS[THERMO_STOPS.length - 1][1]);
}

const thermo = { level: 0, vel: 0, target: 0.4 };
$('thermo').addEventListener('click', () => (thermo.vel += 2.2)); // give it a shake

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

  // Thermometer liquid: a springy fill that sloshes when it changes
  thermo.vel += ((thermo.target - thermo.level) * 60 - thermo.vel * 7) * dt;
  thermo.level += thermo.vel * dt;
  if (Math.abs(thermo.vel) > 0.0005 || Math.abs(thermo.target - thermo.level) > 0.0005) {
    const y = 116 - clamp(thermo.level, 0, 1.05) * 106;
    $('thLiquid').setAttribute('y', y.toFixed(2));
    $('thLiquid').setAttribute('height', (150 - y).toFixed(2));
    $('thMeniscus').setAttribute('cy', y.toFixed(2));
    $('thMeniscus').setAttribute('ry', (2 + Math.min(4, Math.abs(thermo.vel) * 12)).toFixed(2));
  }

  const snowing = scene.p.snow > 0.25;
  snowCap = clamp(snowCap + (snowing ? dt * 2.5 * scene.p.snow : -dt * 4), 0, 14);
  document.documentElement.style.setProperty('--snow', `${snowCap.toFixed(2)}px`);

  document.getElementById('app').classList.toggle('gusty', scene.p.wind > 40);
  sound.update(scene.p, scene.dayF, dt);
  requestAnimationFrame(uiLoop);
}
requestAnimationFrame(uiLoop);

// ---------- loading ----------

// Background hints wait their turn; anything you just did (tapped a button) shows straight away.
const toastQueue = [];
let toastTimer = null;
let lastTap = 0;
addEventListener('pointerdown', () => (lastTap = Date.now()), true);
function toast(msg, ms = 4500) {
  const urgent = Date.now() - lastTap < 3000; // a reply to something you just tapped
  if (toastQueue.some((t) => t.msg === msg) || $('toast').textContent === msg && !$('toast').hidden) return;
  if (urgent) {
    toastQueue.unshift({ msg, ms });
    nextToast(); // replaces whatever is showing; that hint comes back afterwards
  } else {
    toastQueue.push({ msg, ms });
    if (!toastTimer) nextToast();
  }
}
function nextToast() {
  clearTimeout(toastTimer);
  const el = $('toast');
  const t = toastQueue.shift();
  if (!t) {
    toastTimer = null;
    el.hidden = true;
    return;
  }
  el.textContent = t.msg;
  el.hidden = false;
  // Longer messages stay longer (about a second per 15 characters)
  const ms = Math.max(t.ms, 2500 + t.msg.length * 65);
  toastTimer = setTimeout(() => {
    el.hidden = true;
    toastTimer = setTimeout(nextToast, 250);
  }, ms);
}
// Tap a message to dismiss it
$('toast').addEventListener('click', () => nextToast());

async function load() {
  if (!state.loc) return;
  try {
    const loc = state.loc;
    fetchAir(loc.lat, loc.lon)
      .then((air) => {
        if (state.loc !== loc) return;
        state.air = air;
        renderAir();
        updateScene();
      })
      .catch(() => {
        state.air = null;
        renderAir();
      });
    const data = await fetchForecast(loc.lat, loc.lon);
    if (state.loc !== loc) return;
    state.data = data;
    state.offset = Math.min(state.offset, 24);
    renderChart();
    renderForecastCards();
    renderTips();
    renderMoon();
    updateUI();
    updateScene();
    compare.refresh();
    hideSplash();
    lastLoad = Date.now();
    syncNative();
    if (data.offline) toast('📴 You’re offline, so this is the last saved forecast.', 6000);
  } catch (err) {
    console.error(err);
    if (!state.data) $('cond').textContent = 'Couldn’t reach the weather service.';
    toast('Couldn’t load the weather. Check your connection and try again.');
    updateScene();
    hideSplash();
  }
}

function setLocation(loc) {
  if (state.loc && state.loc.name !== loc.name) bump(document.querySelector('.hero'), 'whoosh');
  state.loc = loc;
  state.air = null;
  store.set('loc', loc);
  $('locName').textContent = loc.name;
  renderFavs();
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
  $('windSpeed')._value = undefined;
  if (state.data) {
    renderChart();
    renderForecastCards();
    renderTips();
    renderAir();
    updateUI();
    compare.refresh();
    syncNative();
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
  if (document.activeElement === e.target) showTip(state.offset);
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
  make($('labExtra'), EXTRA_PRESETS, 'extra');
  const globeBtn = document.createElement('button');
  globeBtn.textContent = 'Snow globe';
  globeBtn.addEventListener('click', shakeGlobe);
  $('labExtra').appendChild(globeBtn);
  refreshLab();
}

function refreshLab() {
  for (const [id, key] of [
    ['labWeather', 'weather'],
    ['labTime', 'time'],
    ['labExtra', 'extra'],
  ]) {
    for (const b of $(id).children) {
      if (b.dataset.name == null) continue;
      const active = (state.override[key] ?? 'Live') === b.dataset.name;
      b.classList.toggle('active', active);
    }
  }
}

function toggleLab(open = $('lab').hidden) {
  if (open) $('wardrobe').hidden = true;
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
  if (e.key === 'Escape') {
    toggleLab(false);
    openSearch(false);
    toggleWardrobe(false);
    if (compare.isOpen) compare.close();
    if (!$('globeView').hidden) closeGlobe();
    if (!$('game').hidden) game.close();
    return;
  }
  if (compare.isOpen || !$('globeView').hidden || !$('game').hidden) return;
  if (e.target.matches('input, button, [role="slider"]') && e.key.startsWith('Arrow')) return;
  if (e.key === 'd' || e.key === 'D') toggleLab();
  if (e.key === 'ArrowLeft') cycleFav(-1);
  if (e.key === 'ArrowRight') cycleFav(1);
});

// ---------- 7-day cards ----------

function renderForecastCards() {
  renderDays($('days'), state.data, {
    lat: state.loc.lat,
    lon: state.loc.lon,
    fmtT,
    fmtTime,
    fmtWind,
    reducedMotion,
  });
}

// ---------- compare cities ----------

const compare = new Compare({
  reducedMotion,
  fmtT,
  getMain: () => ({ loc: state.loc, data: state.data }),
});

$('compareBtn').addEventListener('click', () => {
  toggleLab(false);
  compare.open();
});

// ---------- globe ----------

let globe = null;
let globePick = null;

async function openGlobe() {
  const view = $('globeView');
  view.hidden = false;
  $('globeLabel').hidden = true;
  toggleLab(false);
  try {
    if (!globe) {
      const { Globe } = await import('./globe.js');
      globe = new Globe($('globeMount'), {
        reducedMotion,
        onSelect: (place) => {
          globePick = place;
          $('globeName').textContent = `📍 ${place.name}`;
          $('globeLabel').hidden = false;
        },
      });
    }
    $('globeLoading').hidden = true;
    if (!view.hidden) globe.open(state.loc);
  } catch (err) {
    console.error(err);
    $('globeLoading').textContent = 'The globe needs WebGL, which isn’t available here.';
  }
}

function closeGlobe() {
  $('globeView').hidden = true;
  globe?.close();
}

$('globeBtn').addEventListener('click', openGlobe);
$('globeClose').addEventListener('click', closeGlobe);
$('globeGo').addEventListener('click', () => {
  if (!globePick) return;
  closeGlobe();
  setLocation(globePick);
});

// ---------- splash, entrance & playful details ----------

function hideSplash() {
  const splash = $('splash');
  if (!splash || splash.classList.contains('out')) return;
  splash.classList.add('out');
  document.body.classList.add('ready');
  setTimeout(() => splash.remove(), 900);
}
setTimeout(hideSplash, 4000); // never keep people waiting on the splash

// Stat cards tilt towards the pointer, with a soft shine
if (!reducedMotion && matchMedia('(hover: hover)').matches) {
  for (const card of document.querySelectorAll('.stats .card')) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
      card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.classList.add('tilting');
    });
    card.addEventListener('pointerleave', () => {
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  }
}

// Puff watches the pointer
let lookQueued = false;
addEventListener('pointermove', (e) => {
  if (lookQueued || reducedMotion) return;
  lookQueued = true;
  requestAnimationFrame(() => {
    lookQueued = false;
    mascot.look(e.clientX, e.clientY);
  });
});

// ---------- misty window ----------

const mist = new Mist($('mist'), {
  onFirstShow: () => setTimeout(() => toast('💧 The window has misted up. Draw on it!', 5000), 1500),
});

// ---------- what to wear ----------

function renderTips() {
  const hours = Array.from({ length: 25 }, (_, k) => sliceAt(k));
  const { tips, walk } = tipsFor(hours, { fmtT, fmtTime });
  const box = $('tips');
  box.replaceChildren(
    ...tips.map((t, i) => {
      const chip = document.createElement('span');
      chip.className = 'tip-chip';
      chip.style.setProperty('--i', i);
      chip.textContent = `${t.icon} ${t.text}`;
      return chip;
    })
  );
  const w = $('walk');
  w.replaceChildren();
  if (walk) {
    const b = document.createElement('button');
    b.className = 'walk-btn';
    b.title = 'Show that hour';
    b.textContent = `${walk.icon} ${walk.text}`;
    const small = document.createElement('small');
    small.textContent = walk.detail;
    b.append(' ', small);
    b.addEventListener('click', () => {
      stopPlaying();
      setOffset(walk.k);
      $('chartArea').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
    w.appendChild(b);
  }
  $('tipsBar').hidden = false;
  mascot.extraLines = tips.slice(0, 3).map((t) => `${t.icon} ${t.text}!`);
  const top = tips[0];
  if (top) setTimeout(() => mascot.say(`${top.icon} ${top.text}!`), 1600);
}

// ---------- air quality & moon ----------

function renderAir() {
  const air = state.air;
  const scale = state.unit === 'F' ? 'us' : 'eu';
  const value = air ? (air[scale] ?? air[scale === 'us' ? 'eu' : 'us']) : null;
  const usedScale = air && air[scale] == null ? (scale === 'us' ? 'eu' : 'us') : scale;
  const lvl = aqiLevel(value, usedScale);
  $('aqScale').textContent = lvl ? (usedScale === 'us' ? 'US AQI' : 'EU AQI') : '';
  $('aqVal').textContent = lvl ? Math.round(value) : '--';
  $('aqLabel').textContent = lvl ? lvl.label : 'Not available here';
  $('aqIcon').textContent = lvl ? lvl.icon : '·';
  $('aqBar').style.width = lvl ? `${Math.max(4, lvl.pct * 100)}%` : '0';
  $('aqBar').style.background = lvl ? lvl.color : '';
  const pol = air?.pollen;
  const pl = pol ? pollenLevel(pol.value) : null;
  $('pollen').textContent = pl
    ? `🌼 ${pol.type[0].toUpperCase() + pol.type.slice(1)} pollen: ${pl}`
    : '🌼 No pollen data here';
}

function renderMoon() {
  const m = moonInfo(new Date(), state.loc.lat, state.loc.lon, state.data.daily[0].time);
  $('moonLit').setAttribute('d', moonPathD(m.phase, 20, 20, 16));
  $('moonPct').textContent = `${Math.round(m.fraction * 100)}% lit`;
  $('moonName').textContent = m.name;
  $('moonFull').textContent =
    m.daysToFull < 0.75 || m.daysToFull > 28.8
      ? 'Full moon tonight! 🌕'
      : `Full moon in ${Math.round(m.daysToFull)} day${Math.round(m.daysToFull) === 1 ? '' : 's'}`;
  const tf = { hour: 'numeric', minute: '2-digit' };
  $('moonTimes').textContent = `↑ ${m.rise ? fmtTime(m.rise, tf) : '—'} · ↓ ${m.set ? fmtTime(m.set, tf) : '—'}`;
}

// ---------- favourite places ----------

const sameLoc = (a, b) => a && b && Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;

function saveFavs() {
  store.set('favs', state.favs);
  renderFavs();
}

function renderFavs() {
  const isFav = state.favs.some((f) => sameLoc(f, state.loc));
  $('favToggle').textContent = isFav ? '★ Saved (tap to remove)' : '☆ Save this place';
  const list = $('favList');
  list.replaceChildren(
    ...state.favs.map((f) => {
      const chip = document.createElement('span');
      chip.className = 'fav-chip' + (sameLoc(f, state.loc) ? ' current' : '');
      const go = document.createElement('button');
      go.textContent = f.name.split(',')[0];
      go.addEventListener('click', () => {
        openSearch(false);
        setLocation(f);
      });
      const x = document.createElement('button');
      x.textContent = '×';
      x.setAttribute('aria-label', `Remove ${f.name}`);
      x.addEventListener('click', () => {
        state.favs = state.favs.filter((g) => g !== f);
        saveFavs();
      });
      chip.append(go, x);
      return chip;
    })
  );
  const dots = $('favDots');
  dots.hidden = state.favs.length < 2;
  dots.replaceChildren(
    ...state.favs.map((f) => {
      const d = document.createElement('i');
      if (sameLoc(f, state.loc)) d.className = 'on';
      return d;
    })
  );
}

$('favToggle').addEventListener('click', () => {
  if (state.favs.some((f) => sameLoc(f, state.loc))) state.favs = state.favs.filter((f) => !sameLoc(f, state.loc));
  else {
    state.favs.push({ ...state.loc });
    toast(`⭐ Saved ${state.loc.name.split(',')[0]}. Swipe sideways (or use ← →) to switch places.`);
  }
  saveFavs();
});

function cycleFav(dir) {
  const favs = state.favs;
  if (!favs.length || (favs.length === 1 && sameLoc(favs[0], state.loc))) {
    toast('Save a few places with ☆ in the location menu, then swipe between them.');
    return;
  }
  const i = favs.findIndex((f) => sameLoc(f, state.loc));
  const next = i < 0 ? favs[0] : favs[(i + dir + favs.length) % favs.length];
  setLocation(next);
}

let swipe = null;
document.addEventListener('touchstart', (e) => {
  const t = e.target;
  if (e.touches.length !== 1 || t.closest('.scrubber, .days, .compare, .globe-view, .game, .lab, input, #mist.active')) {
    swipe = null;
    return;
  }
  swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!swipe) return;
  const dx = e.changedTouches[0].clientX - swipe.x;
  const dy = e.changedTouches[0].clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && state.favs.length) cycleFav(dx < 0 ? 1 : -1);
});

// ---------- share a picture ----------

$('shareBtn').addEventListener('click', async () => {
  const btn = $('shareBtn');
  btn.disabled = true;
  try {
    const blob = await makeShareImage({
      skyCanvas: $('sky'),
      mascotEl: $('mascot'),
      place: state.loc?.name || 'My sky',
      temp: `${$('temp').textContent}°`,
      cond: $('cond').textContent,
      mood: $('mood').textContent,
      iconUrl: document.querySelector('link[rel="icon"]').href,
    });
    const result = await shareOrDownload(blob, `The sky in ${state.loc?.name || 'my town'}`);
    if (result === 'downloaded') toast('📸 Saved your sky as a picture.');
  } catch (err) {
    console.error(err);
    toast('Couldn’t make the picture, sorry.');
  } finally {
    btn.disabled = false;
  }
});

// ---------- snow globe ----------

function shakeGlobe() {
  scene.flurry();
  buzz('heavy');
  bump($('globeShakeBtn'), 'bump');
}
$('globeShakeBtn').addEventListener('click', shakeGlobe);

// ---------- Puff's wardrobe ----------

const wardrobe = new Wardrobe();
mascot.setStyle(wardrobe.style);

function renderWardrobe() {
  for (const [id, slot] of [
    ['wColors', 'color'],
    ['wHats', 'hat'],
  ]) {
    $(id).replaceChildren(
      ...ITEMS.filter((i) => i.slot === slot).map((item) => {
        const b = document.createElement('button');
        const unlocked = wardrobe.isUnlocked(item);
        const worn = wardrobe.style[slot === 'color' ? 'color' : 'hat'] === item.id;
        b.className = 'w-item' + (worn ? ' active' : '') + (unlocked ? '' : ' locked');
        const icon = document.createElement('span');
        icon.className = 'w-icon';
        icon.textContent = unlocked ? item.icon : '🔒';
        const name = document.createElement('span');
        name.textContent = item.name;
        b.append(icon, name);
        if (!unlocked) {
          const hint = document.createElement('small');
          hint.textContent = item.hint;
          b.append(hint);
        }
        b.setAttribute('aria-pressed', String(worn));
        b.addEventListener('click', () => {
          if (!wardrobe.equip(item)) {
            toast(`🔒 ${item.hint} to unlock ${item.name}.`);
            return;
          }
          mascot.setStyle(wardrobe.style);
          mascot.poke();
          renderWardrobe();
        });
        return b;
      })
    );
  }
}

function toggleWardrobe(open = $('wardrobe').hidden) {
  $('wardrobe').hidden = !open;
  if (open) {
    toggleLab(false);
    renderWardrobe();
  }
}
$('wardrobeBtn').addEventListener('click', () => toggleWardrobe());
$('wardrobeClose').addEventListener('click', () => toggleWardrobe(false));

function recordSightings(t) {
  const kinds = [];
  if (t.rain > 0.1) kinds.push('rain');
  if (t.snow > 0.1) kinds.push('snow');
  if (t.storm > 0.2) kinds.push('storm');
  if (t.fog > 0.5) kinds.push('fog');
  if (t.cloud < 0.3 && t.sunAlt > 0 && !t.rain && !t.snow) kinds.push('clear');
  if (t.temp >= 28) kinds.push('hot');
  if (t.wind >= 40) kinds.push('windy');
  const unlocked = wardrobe.record(kinds);
  if (unlocked.length) {
    toast(`🎉 New for Puff: ${unlocked.map((i) => `${i.icon} ${i.name}`).join(', ')}. Open 👕 Wardrobe!`, 6000);
    if (!$('wardrobe').hidden) renderWardrobe();
  }
}

// ---------- mini-game ----------

const game = new CatchGame({
  el: $('game'),
  canvas: $('gameCanvas'),
  reducedMotion,
  getTheme: () => themeFor(scene.p, scene.nightF),
  getPuffImage: () => mascotImage($('mascot'), { skip: ['.m-umbrella', '.m-zzz'] }),
  onCatch: (kind) => buzz(kind === 'bad' ? 'error' : kind === 'gold' ? 'medium' : 'light'),
  onEnd: (score) => {
    const r = wardrobe.recordScore(score);
    buzz(r.isBest ? 'success' : 'light');
    if (r.unlocked.length && !$('wardrobe').hidden) renderWardrobe();
    return { ...r, best: wardrobe.data.best };
  },
});
$('gameBtn').addEventListener('click', () => {
  toggleLab(false);
  toggleWardrobe(false);
  game.open();
});
$('gameClose').addEventListener('click', () => game.close());

// ---------- offline support ----------

if ('serviceWorker' in navigator && import.meta.env.PROD && !isNative) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// ---------- match the browser's edges to the sky ----------
// Phones show the page background behind the status bar and toolbars, and iPhone Safari
// tints its bars from it. Keep it the same colour as the top of the sky so there's no
// dark strip at the top.

const themeMeta = document.querySelector('meta[name="theme-color"]');
let lastEdge = '';
function syncEdgeColor() {
  // Average what is actually drawn along the top edge of the sky (clouds and all)
  const canvas = $('sky');
  let c = scene.skyTop;
  try {
    const row = canvas.getContext('2d').getImageData(0, 1, canvas.width, 1).data;
    const sum = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < row.length; i += 4 * 12) {
      sum[0] += row[i];
      sum[1] += row[i + 1];
      sum[2] += row[i + 2];
      n++;
    }
    if (n) c = sum.map((v) => v / n);
  } catch {
    /* fall back to the computed sky colour */
  }
  if (!c) return;
  const hex = '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  if (hex === lastEdge) return;
  lastEdge = hex;
  document.documentElement.style.backgroundColor = hex;
  document.body.style.backgroundColor = hex;
  themeMeta?.setAttribute('content', hex);
}
setInterval(syncEdgeColor, 500);

// ---------- iPhone app: Dynamic Island + widgets ----------
// Native Swift code in ios/App/App/SkyMoodNativePlugin.swift. Puff's outfit and message are picked in Swift
// (ios/App/Shared/SkyMoodShared.swift) so the island and the widgets always agree.

const SkyNative = isNative ? registerPlugin('SkyMoodNative') : null;
// In the iPhone app the button is always there; if something is wrong, tapping it says what.
if (isNative) $('islandBtn').hidden = false;

function nativePayload() {
  const c = state.data.current;
  const day = state.data.daily[0];
  return {
    place: state.loc.name.split(',')[0],
    lat: state.loc.lat,
    lon: state.loc.lon,
    code: c.code,
    tempC: c.temp,
    isDay: c.isDay,
    wind: c.wind,
    highC: day.max,
    lowC: day.min,
    fahrenheit: state.unit === 'F',
  };
}

function setIslandButton(active) {
  const btn = $('islandBtn');
  btn.setAttribute('aria-pressed', String(active));
  btn.textContent = active ? '🏝️ Dynamic Island: on' : '🏝️ Dynamic Island';
}

/** After new weather loads: refresh the widgets, and the island if it's showing. */
async function syncNative() {
  if (!SkyNative || !state.data) return;
  const payload = nativePayload();
  SkyNative.updateWidgets(payload).catch(() => {});
  try {
    const st = await SkyNative.islandStatus();
    if (st.supported === false) $('islandBtn').title = 'Needs iOS 16.2 or newer';
    let active = st.active;
    if (active) await SkyNative.updateIsland(payload);
    // iOS removes Live Activities after about 8 hours; bring it back if you had it on.
    else if (store.get('island') && st.enabled) active = (await SkyNative.showIsland(payload)).active;
    setIslandButton(active);
  } catch (err) {
    console.warn(err);
  }
}

$('islandBtn').addEventListener('click', async () => {
  if (!SkyNative) return;
  if (!state.data) {
    toast('Wait a moment for the weather to load, then try again.');
    return;
  }
  let st;
  try {
    st = await SkyNative.islandStatus();
  } catch (err) {
    // Most likely the native part isn't in this build: rebuild with npm run ios
    toast(`🏝️ The app’s native part didn’t answer: ${err?.message || err}`, 9000);
    return;
  }
  if (!st.supported) {
    toast('🏝️ The Dynamic Island needs iOS 16.2 or newer.', 6000);
    return;
  }
  if (!st.enabled && !st.active) {
    toast('🏝️ Live Activities are off for Sky Mood. Turn them on in Settings › Sky Mood › Live Activities.', 8000);
    return;
  }
  try {
    if (st.active) {
      await SkyNative.hideIsland();
      store.set('island', false);
      setIslandButton(false);
      toast('Removed Puff from the Dynamic Island.');
    } else {
      const r = await SkyNative.showIsland(nativePayload());
      store.set('island', true);
      setIslandButton(true);
      buzz('success');
      toast(`💧 Puff is in the Dynamic Island: “${r.line || "Hi!"}” (go to the Home Screen to see it)`, 7000);
    }
  } catch (err) {
    toast(err?.message || 'Couldn’t show it in the Dynamic Island.', 6000);
  }
});

// Coming back to the app after a while: fetch fresh weather (which also updates the island).
let lastLoad = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastLoad > 10 * 60 * 1000) load();
});

// ---------- start ----------

const saved = store.get('loc');
if (saved && typeof saved.lat === 'number') setLocation(saved);
else locate(() => setLocation(LONDON));

setInterval(load, 15 * 60 * 1000); // refresh data
setInterval(() => state.offset === 0 && (updateScene(), state.data && updateUI()), 60 * 1000); // keep the sun moving
