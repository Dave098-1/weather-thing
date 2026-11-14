// Puff's wardrobe: colours and hats unlocked by visiting in different weather
// and by playing "Catch the rain". Progress is kept in this browser only.

export const ITEMS = [
  { id: 'classic', slot: 'color', name: 'Classic blue', icon: '💧' },
  { id: 'mint', slot: 'color', name: 'Misty mint', icon: '🌫️', need: { seen: ['fog'] }, hint: 'Visit on a foggy day' },
  { id: 'storm', slot: 'color', name: 'Storm purple', icon: '⛈️', need: { seen: ['storm'] }, hint: 'Visit during a thunderstorm' },
  { id: 'snow', slot: 'color', name: 'Snow white', icon: '❄️', need: { seen: ['snow'] }, hint: 'Visit on a snowy day' },
  { id: 'gold', slot: 'color', name: 'Sunny gold', icon: '☀️', need: { seen: ['hot'] }, hint: 'Visit on a hot day (28°C / 82°F or more)' },
  { id: 'none', slot: 'hat', name: 'No hat', icon: '🚫' },
  { id: 'flower', slot: 'hat', name: 'Flower', icon: '🌸', need: { seen: ['rain', 'clear'] }, hint: 'See a rainy sky and a clear sky' },
  { id: 'cap', slot: 'hat', name: 'Cap', icon: '🧢', need: { seen: ['windy'] }, hint: 'Visit on a windy day' },
  { id: 'party', slot: 'hat', name: 'Party hat', icon: '🥳', need: { score: 20 }, hint: 'Score 20 in Catch the rain' },
  { id: 'crown', slot: 'hat', name: 'Crown', icon: '👑', need: { score: 45 }, hint: 'Score 45 in Catch the rain' },
];

const KEY = 'puffWardrobe';

export class Wardrobe {
  constructor() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY));
    } catch {
      /* storage unavailable */
    }
    this.data = { seen: [], best: 0, color: 'classic', hat: 'none', ...(saved || {}) };
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable */
    }
  }

  isUnlocked(item) {
    const n = item.need;
    if (!n) return true;
    if (n.seen && !n.seen.every((k) => this.data.seen.includes(k))) return false;
    if (n.score && this.data.best < n.score) return false;
    return true;
  }

  /** Record what the real weather is doing; returns any items that just unlocked. */
  record(kinds) {
    const before = ITEMS.filter((i) => this.isUnlocked(i));
    let changed = false;
    for (const k of kinds) {
      if (!this.data.seen.includes(k)) {
        this.data.seen.push(k);
        changed = true;
      }
    }
    if (changed) this.save();
    return ITEMS.filter((i) => this.isUnlocked(i) && !before.includes(i));
  }

  recordScore(score) {
    const before = ITEMS.filter((i) => this.isUnlocked(i));
    const isBest = score > this.data.best;
    if (isBest) {
      this.data.best = score;
      this.save();
    }
    return { isBest, unlocked: ITEMS.filter((i) => this.isUnlocked(i) && !before.includes(i)) };
  }

  equip(item) {
    if (!this.isUnlocked(item)) return false;
    this.data[item.slot === 'color' ? 'color' : 'hat'] = item.id;
    this.save();
    return true;
  }

  get style() {
    return { color: this.data.color, hat: this.data.hat };
  }
}
