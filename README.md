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
- **Puff the weather buddy:** a little water-drop mascot who dresses for the weather (umbrella,
  sunglasses, beanie and scarf, nightcap) and talks back when you tap it.
- **"Feels like" thermometer** whose liquid sloshes into place (tap it to give it a shake).
- **Heat shimmer** over the horizon on hot, sunny days.
- **7-day flip cards:** tap a day to flip it over and see a tiny animated sky for that day.
- **Compare cities (⚖️):** split-screen skies with a draggable divider, e.g. sunny Lisbon vs rainy London.
- **3D globe (🌍):** spin the Earth (lit by the real sun, so you can see where it's night), tap a city
  or anywhere, and jump to its weather.
- **Effects lab:** press <kbd>D</kbd> (or 🎛️) to preview any weather and time of day.
- **Lively UI:** an animated splash screen, cards that rise in one after another, numbers that count
  up, cards that tilt towards your pointer, a chart that draws itself in, Puff's eyes following your
  cursor, and lightning that lights up the glass panels. All of it calms down with "reduce motion".
- **24-hour chart:** temperature and chance of rain sit in separate strips (each with its own scale),
  with a hover tooltip, click-to-jump, and a hidden data table for screen readers.
- **More sky magic:** rainbows when rain is ending and the sun is low, northern lights on dark nights
  far from the equator, autumn leaves and spring blossom, New Year fireworks, a December snow globe
  you can shake, and a smoggy haze when the air quality is poor.
- **Misty window:** on rainy or foggy days the screen mists up and you can draw on it; it slowly mists
  over again and your drawing drips.
- **What to wear:** umbrella, coat, sunscreen and more from the next 12 hours, plus the best hour for a
  walk (tap it to jump there). Puff mentions the top tip too.
- **Air quality and pollen** card (EU or US index to match your units), and a **moon** card with the
  phase, rise and set times and days until the full moon.
- **Favourite places:** save them from the location menu, then swipe sideways (or press ← →) to switch.
- **Share my sky:** makes a picture of your sky, the temperature and Puff to share or save.
- **Catch the rain:** a 30-second mini-game; the falling things match the weather.
- **Puff's wardrobe:** colours and hats unlocked by visiting in different weather and by game scores.
- **Works offline:** after one visit the site opens without internet and shows the last saved forecast.
- **App icon:** `public/icon.svg` plus PNG sizes and a web app manifest, so "Add to Home Screen" works.
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
- **Air quality and pollen:** Open-Meteo Air Quality API (CAMS data; pollen only covers Europe).
- **Sun and moon positions:** calculated in the browser (`src/astro.js`).
- **Globe map:** coastlines from [Natural Earth](https://www.naturalearthdata.com/) (public domain) via
  the `world-atlas` package, drawn with [three.js](https://threejs.org/).
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
| `src/mascot.js` | Puff the mascot and its outfits |
| `src/forecast.js` | 7-day flip cards with mini skies |
| `src/compare.js` | Split-screen city comparison |
| `src/globe.js` | 3D globe (loaded only when opened) |
| `src/cities.js` | Well-known cities for the globe and quick picks |
| `src/mist.js` | Misty window you can draw on |
| `src/tips.js` | What to wear and the best time for a walk |
| `src/air.js` | Air quality and pollen |
| `src/share.js` | Shareable picture of your sky |
| `src/game.js` | "Catch the rain" mini-game |
| `src/wardrobe.js` | Puff's unlockable colours and hats |
| `public/sw.js` | Service worker for offline use |

## Hosting on GitHub Pages

`.github/workflows/deploy-pages.yml` builds the site and publishes it whenever `main` changes.
One-time setup: in the repository go to **Settings → Pages → Build and deployment → Source** and
choose **GitHub Actions**. The site is then served at `https://<user>.github.io/weather-thing/`.
