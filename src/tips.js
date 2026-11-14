// "What to wear / bring" and the best time for a walk, from the next hours of forecast.

export function tipsFor(hours, { fmtT, fmtTime }) {
  const next = hours.slice(0, 13); // the next ~12 hours
  if (!next.length) return { tips: [], walk: null };
  const maxPop = Math.max(...next.map((h) => h.pop ?? 0));
  const maxUv = Math.max(...next.map((h) => (h.isDay ? h.uv ?? 0 : 0)));
  const minFeels = Math.min(...next.map((h) => h.feels));
  const maxFeels = Math.max(...next.map((h) => h.feels));
  const maxWind = Math.max(...next.map((h) => h.wind));
  const snowy = next.some((h) => (h.code >= 71 && h.code <= 77) || h.code === 85 || h.code === 86);
  const stormy = next.some((h) => h.code >= 95);
  const sunny = next.some((h) => h.isDay && h.code <= 1);

  const tips = [];
  if (stormy) tips.push({ icon: '⛈️', text: 'Storms later: stay close to shelter' });
  if (snowy) tips.push({ icon: '🥾', text: 'Snow boots' });
  if (maxPop >= 50) tips.push({ icon: '☂️', text: 'Take an umbrella' });
  else if (maxPop >= 30) tips.push({ icon: '🌂', text: 'Maybe an umbrella' });

  if (minFeels < -5) tips.push({ icon: '🧤', text: 'Big coat, hat and gloves' });
  else if (minFeels < 5) tips.push({ icon: '🧣', text: 'Warm coat and scarf' });
  else if (minFeels < 12) tips.push({ icon: '🧥', text: 'Bring a jacket' });
  else if (minFeels < 18 && maxFeels < 24) tips.push({ icon: '👕', text: 'A light layer' });
  if (maxFeels >= 30) tips.push({ icon: '💧', text: 'Very hot: drink lots of water' });
  else if (maxFeels >= 24) tips.push({ icon: '🩳', text: 'T-shirt weather' });

  if (maxUv >= 6) tips.push({ icon: '🧴', text: 'Sunscreen (strong sun)' });
  else if (maxUv >= 3) tips.push({ icon: '🧴', text: 'A bit of sunscreen' });
  if (sunny && maxUv >= 3) tips.push({ icon: '🕶️', text: 'Sunglasses' });
  if (maxWind >= 40) tips.push({ icon: '🎩', text: 'Hold on to your hat' });
  if (!tips.length) tips.push({ icon: '😌', text: 'Nothing special needed' });

  // Best hour for a walk: daylight, comfortable, dry and not too windy.
  let best = null;
  let bestScore = -Infinity;
  hours.slice(0, 24).forEach((h, k) => {
    if (!h.isDay) return;
    let score = -Math.abs(h.feels - 19) * 1.3 - (h.pop ?? 0) * 0.45 - Math.max(0, h.wind - 15) * 0.8;
    if (h.code >= 95) score -= 60;
    if (h.code >= 61) score -= 15;
    score -= k * 0.15; // sooner is a bit better
    if (score > bestScore) {
      bestScore = score;
      best = { k, h };
    }
  });
  let walk = null;
  if (best) {
    const when = best.k === 0 ? 'right now' : fmtTime(best.h.time, { weekday: best.k > 12 ? 'short' : undefined, hour: 'numeric' });
    walk = {
      icon: '🚶',
      text: `Best time for a walk: ${when}`,
      detail: `${fmtT(best.h.feels)} · ${Math.round(best.h.pop ?? 0)}% rain`,
      k: best.k,
    };
  }
  return { tips, walk };
}
