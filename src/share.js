// Turn the current sky into a picture you can share or save.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Copy Puff's SVG, keeping only the parts currently shown (outfits are toggled by CSS). */
export async function mascotImage(mascotEl, { skip = [] } = {}) {
  const svg = mascotEl.querySelector('svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true);
  const orig = [...svg.querySelectorAll('*')];
  const copy = [...clone.querySelectorAll('*')];
  orig.forEach((el, i) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || skip.some((sel) => el.matches(sel))) copy[i].remove();
    else if (cs.filter && cs.filter !== 'none' && el.matches('g')) copy[i].setAttribute('style', `filter:${cs.filter}`);
  });
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '240');
  clone.setAttribute('height', '300');
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    return await loadImage(url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

export async function makeShareImage({ skyCanvas, mascotEl, place, temp, cond, mood, iconUrl }) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  // Sky, cropped to fill
  const sw = skyCanvas.width;
  const sh = skyCanvas.height;
  const scale = Math.max(W / sw, H / sh);
  g.drawImage(skyCanvas, (W - sw * scale) / 2, (H - sh * scale) / 2, sw * scale, sh * scale);

  const shade = g.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, 'rgba(0,0,0,0.25)');
  shade.addColorStop(0.4, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);

  const font = (size, weight = 500) => `${weight} ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 24;

  g.font = font(54);
  g.fillText(`📍 ${place}`, W / 2, 130);
  g.font = font(300, 600);
  g.fillText(temp, W / 2, 520);
  g.font = font(64);
  g.fillText(cond, W / 2, 630);
  g.font = font(42, 400);
  wrapText(g, mood, W / 2, 710, W - 160, 54);
  g.shadowBlur = 0;

  const puff = await mascotImage(mascotEl).catch(() => null);
  if (puff) g.drawImage(puff, W / 2 - 120, 830, 240, 300);

  // Brand footer
  try {
    const icon = await loadImage(iconUrl);
    roundRect(g, W / 2 - 170, H - 120, 340, 80, 40);
    g.fillStyle = 'rgba(12,18,38,0.55)';
    g.fill();
    g.drawImage(icon, W / 2 - 150, H - 110, 60, 60);
    g.fillStyle = '#fff';
    g.font = font(40);
    g.textAlign = 'left';
    g.fillText('Sky Mood', W / 2 - 75, H - 66);
  } catch {
    /* icon is optional */
  }

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

function wrapText(g, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lineH;
    } else line = test;
  }
  if (line) g.fillText(line, x, y);
}

/** Share with the system sheet when possible, otherwise download the PNG. */
export async function shareOrDownload(blob, title) {
  const file = new File([blob], 'sky-mood.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sky-mood.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
