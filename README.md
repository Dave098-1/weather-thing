# weather-thing — Sky Mood

A fun weather website where the whole screen *is* the weather: the sky follows the real sun and moon
for your location, and rain, snow, storms, fog and wind are drawn live over it.

## Features

- **Live sky:** the gradient follows the real sun altitude (dawn, day, golden hour, dusk, night), with
  twinkling stars, shooting stars and the correct moon phase.
- **Weather effects:** wind-blown rain with splashes and drops sliding down the "glass", snow you can
  push around with your cursor (it piles up on the cards and the hills), lightning with screen shake,
  drifting fog you can wipe away, parallax clouds that move with the real wind, and leaves on windy days.
- **24-hour time scrubber:** drag through the next 24 hours (or press *Play the day*) and the whole
  scene changes with the forecast.
- **Click the sky** for a burst that matches the weather (sparkles, ripples, snow puffs, shooting stars).
- **Ambient sound** (off by default), generated in the browser with the Web Audio API: rain, wind,
  thunder and birdsong.
- **Effects lab:** press <kbd>D</kbd> (or 🎛️) to preview any weather and time of day.
- °C/°F toggle, city search, and the browser's location lookup. Respects `prefers-reduced-motion`.

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## Data sources

- **Weather:** [Open-Meteo](https://open-meteo.com/) forecast API. Free for non-commercial use, no API
  key needed, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The attribution
  is shown in the page footer.
- **City search:** Open-Meteo geocoding API (based on GeoNames).
- **Sun and moon positions:** calculated in the browser (`src/astro.js`).
- All visuals and sounds are generated in code; no third-party images or recordings.

## Code map

| File | What it does |
| --- | --- |
| `src/main.js` | App wiring: location, UI, scrubber, chart, effects lab |
| `src/scene.js` | Canvas renderer for the sky and every weather effect |
| `src/weather.js` | Open-Meteo requests and weather-code mapping |
| `src/astro.js` | Sun/moon position and moon phase maths |
| `src/audio.js` | Web Audio soundscape |
| `src/mood.js` | Cheeky one-liners per condition |
