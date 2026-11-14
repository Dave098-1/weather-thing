// "Puff" — a little water-drop who dresses for the weather.

const SVG = `
<svg viewBox="0 0 120 150" aria-hidden="true">
  <defs>
    <linearGradient id="puffBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d9f0ff"/>
      <stop offset="1" stop-color="#6fb6ee"/>
    </linearGradient>
  </defs>
  <g class="m-umbrella">
    <path d="M70 6 L95 114" stroke="#6b4b2a" stroke-width="3" stroke-linecap="round"/>
    <path d="M95 114 q2 8 -5 9" fill="none" stroke="#6b4b2a" stroke-width="3" stroke-linecap="round"/>
    <path d="M24 44 Q70 -6 116 44 Q104 35 93 44 Q81 35 70 44 Q59 35 47 44 Q36 35 24 44 Z" fill="#ff6b6b"/>
    <path d="M70 4 Q58 20 47 44 Q59 35 70 44 Q81 35 93 44 Q82 20 70 4 Z" fill="#ffd36b"/>
  </g>
  <g class="m-body">
    <ellipse cx="47" cy="140" rx="9" ry="4.5" fill="#4f93cf"/>
    <ellipse cx="73" cy="140" rx="9" ry="4.5" fill="#4f93cf"/>
    <ellipse cx="23" cy="112" rx="6" ry="8" fill="#8cc6f2" transform="rotate(-20 23 112)"/>
    <ellipse cx="97" cy="112" rx="6" ry="8" fill="#8cc6f2" transform="rotate(20 97 112)"/>
    <path d="M60 50 C67 66 96 78 96 104 C96 125 80 138 60 138 C40 138 24 125 24 104 C24 78 53 66 60 50 Z"
          fill="url(#puffBody)" stroke="#4f93cf" stroke-width="2"/>
    <ellipse cx="44" cy="84" rx="6" ry="9" fill="#fff" opacity="0.55" transform="rotate(25 44 84)"/>
    <ellipse cx="40" cy="115" rx="6" ry="3.5" fill="#ff8fa3" opacity="0.55"/>
    <ellipse cx="80" cy="115" rx="6" ry="3.5" fill="#ff8fa3" opacity="0.55"/>
    <g class="m-eyes"><g class="m-look">
      <circle cx="48" cy="104" r="4.8" fill="#1d2540"/>
      <circle cx="72" cy="104" r="4.8" fill="#1d2540"/>
      <circle cx="49.6" cy="102.4" r="1.6" fill="#fff"/>
      <circle cx="73.6" cy="102.4" r="1.6" fill="#fff"/>
    </g></g>
    <g class="m-sleepy" fill="none" stroke="#1d2540" stroke-width="2.4" stroke-linecap="round">
      <path d="M43 104 q5 4 10 0"/>
      <path d="M67 104 q5 4 10 0"/>
    </g>
    <path class="m-smile" d="M54 116 q6 6 12 0" fill="none" stroke="#1d2540" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse class="m-ooh" cx="60" cy="119" rx="3.5" ry="4.5" fill="#1d2540"/>
  </g>
  <g class="m-sunglasses">
    <path d="M36 97 h22 v7 q0 8 -11 8 q-11 0 -11 -8 Z" fill="#14161f"/>
    <path d="M62 97 h22 v7 q0 8 -11 8 q-11 0 -11 -8 Z" fill="#14161f"/>
    <path d="M58 99 h4" stroke="#14161f" stroke-width="2.5"/>
    <path d="M40 100 l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
    <path d="M66 100 l5 0" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  </g>
  <g class="m-sweat">
    <path d="M92 80 q5 8 0 11 q-5 -3 0 -11 Z" fill="#9fd8ff" stroke="#4f93cf" stroke-width="1"/>
  </g>
  <g class="m-beanie">
    <path d="M37 78 Q60 34 83 78 Z" fill="#e85d75"/>
    <rect x="34" y="72" width="52" height="10" rx="5" fill="#f7c948"/>
    <circle cx="60" cy="44" r="7" fill="#fff"/>
  </g>
  <g class="m-scarf">
    <path d="M27 116 Q60 132 93 116 L94 125 Q60 141 26 125 Z" fill="#e85d75"/>
    <path d="M72 128 l5 16 l9 -3 l-5 -15 Z" fill="#d94a63"/>
    <path d="M40 121 v8 M50 124 v8 M60 125 v8" stroke="#f7c948" stroke-width="2"/>
  </g>
  <g class="m-nightcap">
    <path d="M38 78 Q50 40 100 44 Q76 54 82 78 Z" fill="#6c7bd8"/>
    <rect x="35" y="72" width="50" height="9" rx="4.5" fill="#fff"/>
    <circle cx="100" cy="44" r="6" fill="#fff"/>
  </g>
  <g class="m-hat m-hat-party">
    <path d="M44 70 L60 24 L76 70 Z" fill="#ff6bb5"/>
    <path d="M50 54 L70 54 M47 62 L73 62 M54 42 L66 42" stroke="#ffd36b" stroke-width="3"/>
    <circle cx="60" cy="24" r="6" fill="#ffd36b"/>
  </g>
  <g class="m-hat m-hat-crown">
    <path d="M38 74 L42 46 L51 60 L60 40 L69 60 L78 46 L82 74 Z" fill="#ffd36b" stroke="#e0a82e" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="60" cy="66" r="4" fill="#ff5d73"/>
    <circle cx="48" cy="68" r="3" fill="#6bc6ff"/>
    <circle cx="72" cy="68" r="3" fill="#6bffb8"/>
  </g>
  <g class="m-hat m-hat-flower">
    <circle cx="40" cy="70" r="6.5" fill="#ff8fc0"/>
    <circle cx="50" cy="64" r="6.5" fill="#ff8fc0"/>
    <circle cx="48" cy="76" r="6.5" fill="#ff8fc0"/>
    <circle cx="38" cy="60" r="6.5" fill="#ffb0d4"/>
    <circle cx="44" cy="69" r="4.5" fill="#ffd36b"/>
  </g>
  <g class="m-hat m-hat-cap">
    <path d="M37 76 Q60 40 83 76 Z" fill="#4a7cff"/>
    <path d="M62 72 h32 q6 5 -2 9 h-30 z" fill="#2f5fd6"/>
    <circle cx="60" cy="49" r="3.5" fill="#fff"/>
  </g>
  <g class="m-zzz" fill="#fff" font-family="inherit" font-weight="600">
    <text x="92" y="70" font-size="12">z</text>
    <text x="100" y="56" font-size="15">z</text>
    <text x="108" y="40" font-size="18">Z</text>
  </g>
</svg>
<div class="m-bubble" hidden></div>`;

const LINES = {
  umbrella: ['Splish splash!', 'I love puddles!', 'Good thing I brought this.', 'I’m a raindrop too, you know.'],
  sleepy: ['Zzz… huh? Oh, hi!', 'Five more minutes…', 'Shh, the moon is listening.'],
  cold: ['Brrr!', 'Hot chocolate time?', 'My nose is an ice cube.'],
  hot: ['Melting… melting…', 'Need. Ice cream.', 'I might evaporate!'],
  sunny: ['Looking good, sunshine!', 'Sun’s out, fun’s out!', 'Too cool for clouds.'],
  windy: ['Whoa, hold me!', 'Wheee!', 'I’m going to blow away!'],
  foggy: ['Hello? Anyone there?', 'Where did everyone go?'],
  plain: ['Hi there!', 'Hehe, that tickles!', 'Nice weather. Probably.', 'Boop!'],
};

export class Mascot {
  constructor(container) {
    this.el = container;
    this.el.innerHTML = SVG;
    this.bubble = this.el.querySelector('.m-bubble');
    this.mood = 'plain';
    this.el.addEventListener('click', () => this.poke());
  }

  /** Pick an outfit from the scene numbers (the same ones the sky uses). */
  update(s) {
    const night = s.sunAlt < -4;
    const wet = s.rain > 0.1 || s.storm > 0.2;
    const cold = s.snow > 0.1 || s.temp < 5;
    const hot = s.heat > 0.25 || (s.temp >= 28 && !night);
    const sunny = !night && s.cloud < 0.55 && !wet && s.fog < 0.4;
    const windy = s.wind > 38 && !wet;

    const flags = {
      'has-umbrella': wet,
      'has-beanie': cold && !wet,
      'has-scarf': cold,
      'has-sunglasses': sunny && !cold,
      'has-sweat': hot,
      'is-sleepy': night && !wet && s.snow < 0.1,
      'is-ooh': s.storm > 0.2 || windy || s.fog > 0.5,
      'is-windy': windy || s.wind > 45,
    };
    for (const [cls, on] of Object.entries(flags)) this.el.classList.toggle(cls, !!on);
    this.el.classList.toggle('lean-left', -Math.sin((s.windDir * Math.PI) / 180) < 0);

    this.mood = wet
      ? 'umbrella'
      : flags['is-sleepy']
        ? 'sleepy'
        : cold
          ? 'cold'
          : hot
            ? 'hot'
            : windy
              ? 'windy'
              : s.fog > 0.5
                ? 'foggy'
                : sunny
                  ? 'sunny'
                  : 'plain';
    this.el.setAttribute('aria-label', `Puff the weather buddy (${this.mood})`);
  }

  /** Wardrobe: body colour and a fun hat. */
  setStyle({ color = 'classic', hat = 'none' } = {}) {
    for (const c of [...this.el.classList]) if (c.startsWith('c-') || c.startsWith('hat-')) this.el.classList.remove(c);
    this.el.classList.add(`c-${color}`, `hat-${hat}`);
    this.el.classList.toggle('has-fun-hat', hat !== 'none');
  }

  /** Show a speech bubble without the hop. */
  say(text, ms = 4200) {
    this.bubble.textContent = text;
    this.bubble.hidden = false;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => (this.bubble.hidden = true), ms);
  }

  /** Puff's eyes follow the pointer. */
  look(x, y) {
    this.lookEl ??= this.el.querySelector('.m-look');
    const r = this.el.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height * 0.7);
    const d = Math.hypot(dx, dy) || 1;
    const m = Math.min(2.6, d / 60);
    this.lookEl.setAttribute('transform', `translate(${((dx / d) * m).toFixed(2)} ${((dy / d) * m).toFixed(2)})`);
  }

  poke() {
    this.el.classList.remove('hop');
    void this.el.offsetWidth;
    this.el.classList.add('hop');
    const pool = [...LINES[this.mood], ...LINES.plain.slice(0, 2), ...(this.extraLines || [])];
    let line;
    do line = pool[(Math.random() * pool.length) | 0];
    while (pool.length > 1 && line === this.lastLine);
    this.lastLine = line;
    this.bubble.textContent = line;
    this.bubble.hidden = false;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => (this.bubble.hidden = true), 2600);
  }
}
