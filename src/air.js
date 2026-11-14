// Air quality and pollen from Open-Meteo's free Air Quality API (no key needed).
// Pollen data only exists for Europe, and only in pollen season.

const AIR_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const POLLEN = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];

export async function fetchAir(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: ['european_aqi', 'us_aqi', 'pm2_5', ...POLLEN.map((p) => `${p}_pollen`)].join(','),
    timezone: 'auto',
  });
  const res = await fetch(`${AIR_URL}?${params}`);
  if (!res.ok) throw new Error('Air quality unavailable');
  const c = (await res.json()).current || {};
  let pollen = null;
  for (const p of POLLEN) {
    const v = c[`${p}_pollen`];
    if (v != null && (!pollen || v > pollen.value)) pollen = { type: p, value: v };
  }
  return { eu: c.european_aqi, us: c.us_aqi, pm25: c.pm2_5, pollen };
}

// Status levels: colour is never used alone; every level has an icon and a label.
const LEVELS = [
  { label: 'Good', icon: '😊', color: '#4cc38a' },
  { label: 'Fair', icon: '🙂', color: '#a3d86b' },
  { label: 'Moderate', icon: '😐', color: '#ffd36b' },
  { label: 'Poor', icon: '😷', color: '#ff9a4a' },
  { label: 'Very poor', icon: '⚠️', color: '#ff5d5d' },
  { label: 'Extremely poor', icon: '☣️', color: '#b55dff' },
];

const US_LABELS = ['Good', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy', 'Very unhealthy', 'Hazardous'];

/** scale: 'eu' (European AQI, 0–100+) or 'us' (US AQI, 0–500). */
export function aqiLevel(value, scale) {
  if (value == null) return null;
  let i;
  if (scale === 'us') {
    i = value <= 50 ? 0 : value <= 100 ? 1 : value <= 150 ? 2 : value <= 200 ? 3 : value <= 300 ? 4 : 5;
    const map = [0, 2, 3, 3, 4, 5]; // pick matching colours/icons
    return { ...LEVELS[map[i]], label: US_LABELS[i], index: i, pct: Math.min(1, value / 300) };
  }
  i = value <= 20 ? 0 : value <= 40 ? 1 : value <= 60 ? 2 : value <= 80 ? 3 : value <= 100 ? 4 : 5;
  return { ...LEVELS[i], index: i, pct: Math.min(1, value / 120) };
}

export function pollenLevel(v) {
  if (v == null) return null;
  if (v < 1) return 'None';
  if (v < 20) return 'Low';
  if (v < 100) return 'Moderate';
  if (v < 500) return 'High';
  return 'Very high';
}

/** How hazy the sky should look (0..1). */
export function hazeFor(air) {
  if (!air) return 0;
  if (air.eu != null) return Math.max(0, Math.min(1, (air.eu - 45) / 55));
  if (air.us != null) return Math.max(0, Math.min(1, (air.us - 90) / 110));
  return 0;
}
