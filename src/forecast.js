// 7-day forecast as flip cards. The back of each card runs its own tiny sky.
import { Scene } from './scene.js';
import { describe, weatherToScene, heatFor } from './weather.js';
import { skyAt } from './astro.js';

let minis = [];

function dayScene(d, lat, lon) {
  const sc = weatherToScene({ code: d.code, cloud: 0, precip: d.precipSum / 12, wind: d.windMax, windDir: d.windDir });
  const sky = skyAt(new Date((d.time + 13 * 3600) * 1000), lat, lon); // early afternoon
  return { ...sc, ...sky, temp: d.max, heat: heatFor(d.max, sc, sky.sunAlt) };
}

export function renderDays(container, data, { lat, lon, fmtT, fmtTime, fmtWind, reducedMotion }) {
  minis.forEach((m) => m.stop());
  minis = [];
  container.innerHTML = '';

  const days = data.daily;
  const lo = Math.min(...days.map((d) => d.min));
  const hi = Math.max(...days.map((d) => d.max));
  const span = hi - lo || 1;

  days.forEach((d, i) => {
    const info = describe(d.code, true);
    const name = i === 0 ? 'Today' : fmtTime(d.time + 12 * 3600, { weekday: 'short' });
    const left = ((d.min - lo) / span) * 100;
    const right = ((hi - d.max) / span) * 100;

    const card = document.createElement('button');
    card.className = 'day';
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', `${name}: ${info.label}, high ${fmtT(d.max)}, low ${fmtT(d.min)}. Flip for details.`);
    card.style.setProperty('--i', i);
    card.innerHTML = `
      <span class="day-inner">
        <span class="day-face day-front">
          <span class="day-name">${name}</span>
          <span class="day-ico">${info.emoji}</span>
          <span class="day-cond">${info.label}</span>
          <span class="day-temps">
            <b>${fmtT(d.max)}</b>
            <span class="range"><i style="left:${left}%;right:${right}%"></i></span>
            <span>${fmtT(d.min)}</span>
          </span>
        </span>
        <span class="day-face day-back">
          <canvas></canvas>
          <span class="day-back-info">
            <span class="day-name">${name}</span>
            <span>💧 ${Math.round(d.pop)}% chance</span>
            <span>💨 up to ${fmtWind(d.windMax)}</span>
            <span>☀️ UV ${Math.round(d.uvMax)}</span>
            <span>🌡️ feels ${fmtT(d.feelsMax)}</span>
          </span>
        </span>
      </span>`;

    let mini = null;
    let stopTimer;
    card.addEventListener('click', () => {
      const flipped = !card.classList.contains('flipped');
      card.classList.toggle('flipped', flipped);
      card.setAttribute('aria-pressed', String(flipped));
      clearTimeout(stopTimer);
      if (flipped) {
        if (!mini) {
          const back = card.querySelector('.day-back');
          mini = new Scene(back.querySelector('canvas'), { reducedMotion, sizeTo: back, interactive: false });
          mini.setTarget(dayScene(d, lat, lon));
          mini.jump();
          minis.push(mini);
        }
        mini.start();
      } else if (mini) {
        stopTimer = setTimeout(() => mini.stop(), 800);
      }
    });
    container.appendChild(card);
  });
}
