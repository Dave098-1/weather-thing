// A handful of well-known cities for the globe and quick comparisons.
export const CITIES = [
  ['Tokyo', 'Japan', 35.68, 139.69],
  ['Delhi', 'India', 28.61, 77.21],
  ['Shanghai', 'China', 31.23, 121.47],
  ['Beijing', 'China', 39.9, 116.41],
  ['Mumbai', 'India', 19.08, 72.88],
  ['Dhaka', 'Bangladesh', 23.81, 90.41],
  ['Seoul', 'South Korea', 37.57, 126.98],
  ['Bangkok', 'Thailand', 13.76, 100.5],
  ['Singapore', 'Singapore', 1.35, 103.82],
  ['Jakarta', 'Indonesia', -6.21, 106.85],
  ['Manila', 'Philippines', 14.6, 120.98],
  ['Ulaanbaatar', 'Mongolia', 47.89, 106.91],
  ['Sydney', 'Australia', -33.87, 151.21],
  ['Melbourne', 'Australia', -37.81, 144.96],
  ['Perth', 'Australia', -31.95, 115.86],
  ['Auckland', 'New Zealand', -36.85, 174.76],
  ['Honolulu', 'United States', 21.31, -157.86],
  ['Anchorage', 'United States', 61.22, -149.9],
  ['Vancouver', 'Canada', 49.28, -123.12],
  ['Los Angeles', 'United States', 34.05, -118.24],
  ['Mexico City', 'Mexico', 19.43, -99.13],
  ['Chicago', 'United States', 41.88, -87.63],
  ['Toronto', 'Canada', 43.65, -79.38],
  ['New York', 'United States', 40.71, -74.01],
  ['Havana', 'Cuba', 23.11, -82.37],
  ['Bogotá', 'Colombia', 4.71, -74.07],
  ['Lima', 'Peru', -12.05, -77.04],
  ['Santiago', 'Chile', -33.45, -70.67],
  ['Buenos Aires', 'Argentina', -34.6, -58.38],
  ['São Paulo', 'Brazil', -23.55, -46.63],
  ['Rio de Janeiro', 'Brazil', -22.91, -43.17],
  ['Nuuk', 'Greenland', 64.18, -51.72],
  ['Reykjavík', 'Iceland', 64.15, -21.94],
  ['Lisbon', 'Portugal', 38.72, -9.14],
  ['Madrid', 'Spain', 40.42, -3.7],
  ['London', 'United Kingdom', 51.51, -0.13],
  ['Paris', 'France', 48.86, 2.35],
  ['Berlin', 'Germany', 52.52, 13.4],
  ['Rome', 'Italy', 41.9, 12.5],
  ['Stockholm', 'Sweden', 59.33, 18.07],
  ['Moscow', 'Russia', 55.76, 37.62],
  ['Istanbul', 'Türkiye', 41.01, 28.98],
  ['Cairo', 'Egypt', 30.04, 31.24],
  ['Dubai', 'United Arab Emirates', 25.2, 55.27],
  ['Lagos', 'Nigeria', 6.52, 3.38],
  ['Nairobi', 'Kenya', -1.29, 36.82],
  ['Johannesburg', 'South Africa', -26.2, 28.05],
  ['Cape Town', 'South Africa', -33.92, 18.42],
].map(([name, country, lat, lon]) => ({ name, country, lat, lon }));

/** Great-circle distance in km. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestCity(lat, lon) {
  let best = null;
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(lat, lon, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { city: best, km: bestD };
}
