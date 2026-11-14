const LINES = {
  clearDay: [
    'Not a cloud in sight. Go touch some grass.',
    'Blue sky, zero excuses.',
    'The sun clocked in early today.',
    'Sunglasses: mandatory. Attitude: optional.',
  ],
  hot: [
    'Sunscreen o’clock. ☀️',
    'The sun is showing off again.',
    'Ice cream is basically hydration, right?',
    'It’s giving “oven with the door open”.',
  ],
  clearNight: [
    'Perfect night for stargazing.',
    'The moon has the stage tonight.',
    'Make a wish. Shooting stars are on shift.',
    'Clear skies, cosy socks.',
  ],
  partly: [
    'Clouds doing a little drive-by.',
    'Sun and clouds are sharing custody of the sky.',
    'Partly cloudy, fully fabulous.',
    'Peekaboo, sunshine.',
  ],
  cloudy: [
    'The sky forgot to pay its light bill.',
    'Gray, but make it cozy.',
    'A great day for a blanket and a book.',
    'One big fluffy ceiling.',
  ],
  fog: [
    'The world has been temporarily un-rendered.',
    'Visibility: vibes only. Drive slow.',
    'Mysterious. Moody. Mildly damp.',
  ],
  drizzle: [
    'It’s not rain, it’s sky mist. Still bring a hood.',
    'Gentle sprinkles. Your hair will notice.',
    'The clouds are just sneezing a little.',
  ],
  rain: [
    'Bring a jacket. And maybe a boat.',
    'Puddle-jumping conditions: excellent.',
    'Perfect excuse to stay in with tea.',
    'Umbrella’s big moment has arrived.',
  ],
  heavy: [
    'Ark-building weather.',
    'The sky is emptying its bathtub.',
    'Wellies on. Dignity optional.',
  ],
  snow: [
    'Snowball fight? Snowball fight.',
    'Hot chocolate is now mandatory.',
    'The world got a fresh coat of paint.',
    'Build a snow-person. Name them Gerald.',
  ],
  storm: [
    'The sky is having a moment. Stay inside.',
    'Unplug the toaster, it’s spicy out there.',
    'Nature’s light show. Watch from the sofa.',
  ],
  freezing: [
    'Cold enough to freeze your thoughts.',
    'Layers. All of them.',
    'Your nose will file a complaint.',
  ],
  windy: [
    'Hold onto your hat. Literally.',
    'Great day for kites, bad day for hair.',
    'The trees are doing the wave.',
  ],
};

export function moodFor({ kind, temp, night, wind, seed }) {
  let key = kind;
  const calm = ['clear', 'partly', 'cloudy'].includes(kind);
  if (kind === 'clear') key = night ? 'clearNight' : temp >= 28 ? 'hot' : 'clearDay';
  if (calm && temp <= -5) key = 'freezing';
  if (calm && wind >= 40) key = 'windy';
  const arr = LINES[key] || LINES.cloudy;
  return arr[Math.abs(seed) % arr.length];
}
