// Sun & moon positions, based on the well-known formulas from
// Astronomy Answers (also used by the SunCalc library).
// Azimuth is measured in radians from south, positive towards west.

const PI = Math.PI;
const rad = PI / 180;
const dayMs = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const e = rad * 23.4397; // obliquity of the Earth

const toDays = (date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000;

const rightAscension = (l, b) =>
  Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
const declination = (l, b) =>
  Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
const azimuth = (H, phi, dec) =>
  Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
const altitude = (H, phi, dec) =>
  Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
const siderealTime = (d, lw) => rad * (280.16 + 360.9856235 * d) - lw;

const solarMeanAnomaly = (d) => rad * (357.5291 + 0.98560028 * d);

function eclipticLongitude(M) {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372; // perihelion of the Earth
  return M + C + P + PI;
}

function sunCoords(d) {
  const L = eclipticLongitude(solarMeanAnomaly(d));
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d) {
  const L = rad * (218.316 + 13.176396 * d);
  const M = rad * (134.963 + 13.064993 * d);
  const F = rad * (93.272 + 13.22935 * d);
  const l = L + rad * 6.289 * Math.sin(M);
  const b = rad * 5.128 * Math.sin(F);
  const dt = 385001 - 20905 * Math.cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
}

export function sunPosition(date, lat, lng) {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  return { azimuth: azimuth(H, phi, c.dec), altitude: altitude(H, phi, c.dec) };
}

export function moonPosition(date, lat, lng) {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  return { azimuth: azimuth(H, phi, c.dec), altitude: altitude(H, phi, c.dec) };
}

/** phase: 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter */
export function moonIllumination(date) {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000;
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
  );
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
  );
  return {
    fraction: (1 + Math.cos(inc)) / 2,
    phase: 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / PI,
  };
}

export const toDeg = (r) => r / rad;

/** Everything the sky renderer needs to know about the sun and moon. */
export function skyAt(date, lat, lon) {
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

/** Approximate point on Earth where the sun is directly overhead. */
export function subsolarPoint(date = new Date()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const doy = (date - start) / dayMs;
  const lat = -23.44 * Math.cos(((2 * PI) / 365) * (doy + 10));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  let lon = (12 - utcHours) * 15;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

const PHASES = [
  ['New moon', '🌑'],
  ['Waxing crescent', '🌒'],
  ['First quarter', '🌓'],
  ['Waxing gibbous', '🌔'],
  ['Full moon', '🌕'],
  ['Waning gibbous', '🌖'],
  ['Last quarter', '🌗'],
  ['Waning crescent', '🌘'],
];

/**
 * Moon details for a day. dayStartSec is local midnight (unix seconds).
 * Rise and set are found by sampling the moon's altitude every 10 minutes.
 */
export function moonInfo(now, lat, lon, dayStartSec) {
  const { phase, fraction } = moonIllumination(now);
  const idx = Math.round(phase * 8) % 8;
  const [name, emoji] = PHASES[idx];
  let rise = null;
  let set = null;
  let prev = moonPosition(new Date(dayStartSec * 1000), lat, lon).altitude;
  for (let m = 10; m <= 24 * 60; m += 10) {
    const t = dayStartSec + m * 60;
    const alt = moonPosition(new Date(t * 1000), lat, lon).altitude;
    if (prev < 0 && alt >= 0 && rise == null) rise = t - 600 * (alt / (alt - prev));
    if (prev >= 0 && alt < 0 && set == null) set = t - 600 * (alt / (alt - prev));
    prev = alt;
  }
  const daysToFull = (((0.5 - phase) % 1) + 1) % 1 * 29.53;
  return { phase, fraction, name, emoji, rise, set, daysToFull };
}

/** SVG path for the lit part of the moon. */
export function moonPathD(phase, cx, cy, r) {
  const k = Math.cos(2 * Math.PI * phase); // 1 = new, -1 = full
  const rx = Math.abs(k) * r;
  if (phase < 0.5) {
    // lit on the right
    return `M${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx} ${cy + r} A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${cx} ${cy - r}Z`;
  }
  return `M${cx} ${cy + r} A${r} ${r} 0 0 1 ${cx} ${cy - r} A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} ${cx} ${cy + r}Z`;
}
