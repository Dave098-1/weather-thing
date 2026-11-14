// Weather data from Open-Meteo (https://open-meteo.com), free for
// non-commercial use with attribution (CC BY 4.0). No API key needed.

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

const CURRENT_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'is_day',
  'weather_code',
  'cloud_cover',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
];

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_direction_10m',
  'uv_index',
  'is_day',
];

const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'sunrise',
  'sunset',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_direction_10m_dominant',
  'uv_index_max',
];

export async function fetchForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: CURRENT_VARS.join(','),
    hourly: HOURLY_VARS.join(','),
    daily: DAILY_VARS.join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '7',
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`The weather service answered with an error (${res.status}).`);
  return normalize(await res.json());
}

function normalize(raw) {
  const c = raw.current;
  const h = raw.hourly;
  const d = raw.daily;
  return {
    timezone: raw.timezone,
    current: {
      time: c.time,
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      isDay: !!c.is_day,
      code: c.weather_code,
      cloud: c.cloud_cover,
      precip: c.precipitation,
      wind: c.wind_speed_10m,
      windDir: c.wind_direction_10m,
    },
    hourly: h.time.map((time, i) => ({
      time,
      temp: h.temperature_2m[i],
      feels: h.apparent_temperature[i],
      humidity: h.relative_humidity_2m[i],
      pop: h.precipitation_probability?.[i] ?? 0,
      precip: h.precipitation[i],
      code: h.weather_code[i],
      cloud: h.cloud_cover[i],
      wind: h.wind_speed_10m[i],
      windDir: h.wind_direction_10m[i],
      uv: h.uv_index?.[i] ?? 0,
      isDay: !!h.is_day[i],
    })),
    daily: d.time.map((time, i) => ({
      time,
      max: d.temperature_2m_max[i],
      min: d.temperature_2m_min[i],
      sunrise: d.sunrise[i],
      sunset: d.sunset[i],
      code: d.weather_code?.[i] ?? 3,
      feelsMax: d.apparent_temperature_max?.[i] ?? d.temperature_2m_max[i],
      pop: d.precipitation_probability_max?.[i] ?? 0,
      precipSum: d.precipitation_sum?.[i] ?? 0,
      windMax: d.wind_speed_10m_max?.[i] ?? 0,
      windDir: d.wind_direction_10m_dominant?.[i] ?? 270,
      uvMax: d.uv_index_max?.[i] ?? 0,
    })),
  };
}

export async function searchCities(query) {
  const params = new URLSearchParams({ name: query, count: '6', language: 'en', format: 'json' });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error('City search failed.');
  const json = await res.json();
  return json.results || [];
}

// WMO weather interpretation codes, as used by Open-Meteo.
const CODES = {
  0: ['Clear sky', 'clear'],
  1: ['Mainly clear', 'clear'],
  2: ['Partly cloudy', 'partly'],
  3: ['Overcast', 'cloudy'],
  45: ['Fog', 'fog'],
  48: ['Freezing fog', 'fog'],
  51: ['Light drizzle', 'drizzle'],
  53: ['Drizzle', 'drizzle'],
  55: ['Heavy drizzle', 'drizzle'],
  56: ['Freezing drizzle', 'drizzle'],
  57: ['Heavy freezing drizzle', 'drizzle'],
  61: ['Light rain', 'rain'],
  63: ['Rain', 'rain'],
  65: ['Heavy rain', 'heavy'],
  66: ['Freezing rain', 'rain'],
  67: ['Heavy freezing rain', 'heavy'],
  71: ['Light snow', 'snow'],
  73: ['Snow', 'snow'],
  75: ['Heavy snow', 'snow'],
  77: ['Snow grains', 'snow'],
  80: ['Rain showers', 'rain'],
  81: ['Heavy showers', 'heavy'],
  82: ['Violent showers', 'heavy'],
  85: ['Snow showers', 'snow'],
  86: ['Heavy snow showers', 'snow'],
  95: ['Thunderstorm', 'storm'],
  96: ['Thunderstorm with hail', 'storm'],
  99: ['Severe thunderstorm', 'storm'],
};

const EMOJI = {
  clear: ['☀️', '🌙'],
  partly: ['⛅', '☁️'],
  cloudy: ['☁️', '☁️'],
  fog: ['🌫️', '🌫️'],
  drizzle: ['🌦️', '🌧️'],
  rain: ['🌧️', '🌧️'],
  heavy: ['🌧️', '🌧️'],
  snow: ['🌨️', '🌨️'],
  storm: ['⛈️', '⛈️'],
};

export function describe(code, isDay = true) {
  const [label, kind] = CODES[code] || ['Unknown', 'cloudy'];
  let emoji = EMOJI[kind][isDay ? 0 : 1];
  if (code === 1 && isDay) emoji = '🌤️';
  return { label, kind, emoji };
}

/** How strong the heat shimmer should be (0..1): hot, sunny and dry. */
export function heatFor(tempC, scene, sunAlt) {
  if (tempC < 26 || sunAlt < 5 || scene.rain > 0.05 || scene.snow > 0) return 0;
  return Math.min(1, (tempC - 26) / 8) * (1 - scene.cloud * 0.8);
}

/** Turn a weather reading into the numbers the sky renderer understands. */
export function weatherToScene(s) {
  const c = s.code;
  const sc = {
    rain: 0,
    snow: 0,
    storm: 0,
    fog: 0,
    cloud: (s.cloud ?? 0) / 100,
    wind: s.wind ?? 0,
    windDir: s.windDir ?? 270,
  };
  if (c >= 51 && c <= 57) sc.rain = 0.12 + ((c % 10) - 1) * 0.03;
  if ([61, 66, 80].includes(c)) sc.rain = 0.38;
  if ([63, 81].includes(c)) sc.rain = 0.62;
  if ([65, 67, 82].includes(c)) sc.rain = 0.92;
  if ([71, 77, 85].includes(c)) sc.snow = 0.38;
  if (c === 73) sc.snow = 0.62;
  if ([75, 86].includes(c)) sc.snow = 0.92;
  if (c >= 95) {
    sc.rain = 0.85;
    sc.storm = c === 95 ? 0.75 : 1;
  }
  if (c === 45 || c === 48) sc.fog = 0.85;

  // Let the measured precipitation push intensity up a bit.
  if (sc.rain > 0) sc.rain = Math.max(sc.rain, Math.min(1, (s.precip ?? 0) / 10));
  if (sc.rain || sc.snow || sc.storm) sc.cloud = Math.max(sc.cloud, 0.8);
  if (c === 0) sc.cloud = Math.min(sc.cloud, 0.1);
  if (c === 1) sc.cloud = Math.min(Math.max(sc.cloud, 0.12), 0.3);
  if (c === 2) sc.cloud = Math.max(sc.cloud, 0.45);
  if (c === 3) sc.cloud = Math.max(sc.cloud, 0.92);
  return sc;
}
