import { writeFile } from 'node:fs/promises';

const C = {
  canvas0: '#04100a',
  canvas1: '#06130d',
  canvas2: '#030905',
  surface: '#0a1710',
  titlebar: '#0e2117',
  border: 'rgba(60,184,113,0.30)',
  text: '#E8F5EC',
  muted: '#7fa98a',
  green: '#3CB871',
  greenL: '#74D49A',
  greenX: '#4ADE80',
  greenDeep: '#1f9d63',
  mint: '#8ff0b8',
  red: '#F87171',
  amber: '#E2B77A',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function defs(id, w, h) {
  return `
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${C.canvas0}"/>
      <stop offset="55%" stop-color="${C.canvas1}"/>
      <stop offset="100%" stop-color="${C.canvas2}"/>
    </linearGradient>
    <linearGradient id="${id}-accent" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.mint}"/>
      <stop offset="55%" stop-color="${C.green}"/>
      <stop offset="100%" stop-color="${C.greenDeep}"/>
    </linearGradient>
    <radialGradient id="${id}-glow" cx="0.12" cy="0.30" r="0.75">
      <stop offset="0%" stop-color="${C.green}" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="${C.greenDeep}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${C.greenDeep}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-vignette" cx="0.5" cy="0.5" r="0.78">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.5"/>
    </radialGradient>
    <pattern id="${id}-grid" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.85" fill="${C.muted}" opacity="0.30"/>
    </pattern>
    <filter id="${id}-blur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="52"/>
    </filter>
    <filter id="${id}-noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" result="n"/>
      <feColorMatrix type="saturate" values="0" in="n" result="g"/>
      <feBlend in="SourceGraphic" in2="g" mode="soft-light"/>
    </filter>
    <linearGradient id="${id}-title" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${C.mint}"/>
      <stop offset="45%" stop-color="${C.greenL}"/>
      <stop offset="100%" stop-color="${C.greenDeep}"/>
    </linearGradient>
    <linearGradient id="${id}-term" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${C.surface}"/>
      <stop offset="100%" stop-color="${C.canvas2}"/>
    </linearGradient>
  </defs>`;
}

function shader(id, w, h) {
  return `
  <rect width="${w}" height="${h}" fill="url(#${id}-bg)"/>
  <rect width="${w}" height="${h}" fill="url(#${id}-glow)"/>
  <g filter="url(#${id}-blur)" opacity="0.5">
    <ellipse cx="${w * 0.18}" cy="${h * 0.15}" rx="260" ry="150" fill="#0f7a45">
      <animate attributeName="cx" values="${w * 0.18};${w * 0.30};${w * 0.18}" dur="20s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="${h * 0.15};${h * 0.45};${h * 0.15}" dur="24s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="${w * 0.78}" cy="${h * 0.9}" rx="240" ry="140" fill="#0a4d6b">
      <animate attributeName="cx" values="${w * 0.78};${w * 0.62};${w * 0.78}" dur="22s" repeatCount="indefinite"/>
      <animate attributeName="cy" values="${h * 0.9};${h * 0.65};${h * 0.9}" dur="18s" repeatCount="indefinite"/>
    </ellipse>
    <ellipse cx="${w * 0.5}" cy="${h * 1.1}" rx="220" ry="110" fill="#1d5c2e">
      <animate attributeName="cx" values="${w * 0.5};${w * 0.34};${w * 0.5}" dur="26s" repeatCount="indefinite"/>
    </ellipse>
  </g>
  <rect width="${w}" height="${h}" fill="url(#${id}-vignette)"/>
  <rect width="${w}" height="${h}" filter="url(#${id}-noise)" opacity="0.03" fill="${C.text}"/>`;
}

function windowChrome(id, x, y, w, h, label) {
  const titleH = 36;
  return `
  <rect x="${x + 4}" y="${y + 7}" width="${w}" height="${h}" rx="14" fill="#000" opacity="0.45"/>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="url(#${id}-term)" stroke="${C.border}" stroke-width="1"/>
  <path d="M${x} ${y + 14}a14 14 0 0 1 14-14h${w - 28}a14 14 0 0 1 14 14v${titleH - 14}H${x}Z" fill="${C.titlebar}"/>
  <line x1="${x}" y1="${y + titleH}" x2="${x + w}" y2="${y + titleH}" stroke="${C.border}" stroke-width="1"/>
  <circle cx="${x + 22}" cy="${y + 19}" r="5.5" fill="${C.red}"/>
  <circle cx="${x + 40}" cy="${y + 19}" r="5.5" fill="${C.amber}"/>
  <circle cx="${x + 58}" cy="${y + 19}" r="5.5" fill="${C.greenX}"/>
  <text x="${x + w / 2}" y="${y + 23}" text-anchor="middle" fill="${C.muted}" font-size="11.5" font-family="ui-monospace,SFMono-Regular,Consolas,monospace">${esc(label)}</text>`;
}

const MONO = 'ui-monospace,SFMono-Regular,Consolas,monospace';

function heroSvg() {
  const w = 1200;
  const h = 320;
  const id = 'hero';
  const tx = 770;
  const ty = 52;
  const tw = 380;
  const th = 216;
  const terminalLines = [
    { prompt: true, text: 'npm run pixqr -- build --key 123.456...', color: C.text },
    { check: true, text: '000201...6304ABCD   CRC ok', color: C.greenX },
    { arrow: true, text: 'pix-qr-kit v0.4.0', color: C.muted },
  ];
  let lines = '';
  terminalLines.forEach((l, i) => {
    const y = ty + 78 + i * 40;
    if (l.prompt) {
      lines += `<text x="${tx + 20}" y="${y}" fill="${C.greenL}" font-size="14" font-family="${MONO}">$</text>
      <text x="${tx + 34}" y="${y}" fill="${l.color}" font-size="14" font-family="${MONO}">${esc(l.text)}</text>`;
    } else if (l.check) {
      lines += `<text x="${tx + 20}" y="${y}" fill="${C.greenX}" font-size="14" font-family="${MONO}">✓</text>
      <text x="${tx + 40}" y="${y}" fill="${l.color}" font-size="14" font-family="${MONO}">${esc(l.text)}</text>`;
    } else {
      lines += `<text x="${tx + 20}" y="${y}" fill="${C.greenDeep}" font-size="14" font-family="${MONO}">→</text>
      <text x="${tx + 40}" y="${y}" fill="${l.color}" font-size="14" font-family="${MONO}">${esc(l.text)}</text>`;
    }
  });
  const vW = 74;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="pix-qr-kit banner">
${defs(id, w, h)}
${shader(id, w, h)}
  <rect x="0" y="18" width="5" height="${h - 36}" rx="2.5" fill="url(#${id}-accent)"/>
  <rect x="0" y="0" width="${w * 0.52}" height="${h}" fill="url(#${id}-grid)" opacity="0.5"/>
  <text x="70" y="152" fill="url(#${id}-title)" font-size="62" font-family="ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif" font-weight="800" letter-spacing="-2">pix-qr-kit</text>
  <text x="70" y="190" fill="${C.muted}" font-size="17" font-family="ui-sans-serif,system-ui,sans-serif">BR Code Pix em TypeScript — gere, valide, renderize e concilie</text>
  <rect x="70" y="216" width="${vW}" height="30" rx="8" fill="${C.green}" fill-opacity="0.16" stroke="${C.green}" stroke-opacity="0.55"/>
  <text x="${70 + vW / 2}" y="236" text-anchor="middle" fill="${C.greenL}" font-size="13" font-family="${MONO}" font-weight="600">v0.4.0</text>
  <text x="${70 + vW + 26}" y="236" fill="${C.muted}" font-size="13.5" font-family="ui-sans-serif,system-ui,sans-serif">por fraudar</text>
${windowChrome(id, tx, ty, tw, th, 'pixqr · zsh')}
  ${lines}
</svg>`;
}

const terminalSteps = [
  { prompt: true, text: 'npm run pixqr -- build --key 123.456.789-09 --amount 123.45', color: C.text },
  { check: true, text: '0002010102122633...6304ABCD  CRC ok', color: C.greenX },
  { prompt: true, text: 'npm run pixqr -- qr --payload 000201... --styled --logo logo.png', color: C.text },
  { check: true, text: 'PNG 640px · payload decodificado', color: C.greenX },
  { prompt: true, text: 'npm test', color: C.text },
  { check: true, text: '27 passed (3 files) · tsc limpo', color: C.greenX },
];

function terminalSvg() {
  const w = 1200;
  const h = 320;
  const id = 'term';
  const tx = 60;
  const ty = 44;
  const tw = w - 120;
  const th = h - 88;
  let lines = '';
  terminalSteps.forEach((l, i) => {
    const y = ty + 84 + i * 30;
    const text = l.text;
    const width = text.length * 7.7 + 6;
    const start = 0.04 + i * 0.075;
    const end = start + 0.07;
    const clip = `${id}-c${i}`;
    lines += `
    <clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><rect x="${tx + 34}" y="${y - 16}" width="0" height="22"><animate attributeName="width" values="0;0;${width};${width}" keyTimes="0;${start.toFixed(2)};${end.toFixed(2)};1" dur="9s" repeatCount="indefinite"/></rect></clipPath>`;
    if (l.prompt) {
      lines += `
    <text x="${tx + 20}" y="${y}" fill="${C.greenL}" font-size="14" font-family="${MONO}">$</text>
    <text x="${tx + 34}" y="${y}" fill="${l.color}" font-size="14" font-family="${MONO}" clip-path="url(#${clip})">${esc(text)}</text>`;
    } else {
      lines += `
    <text x="${tx + 20}" y="${y}" fill="${C.greenX}" font-size="14" font-family="${MONO}">✓</text>
    <text x="${tx + 34}" y="${y}" fill="${l.color}" font-size="14" font-family="${MONO}" clip-path="url(#${clip})">${esc(text)}</text>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="terminal pixqr">
${defs(id, w, h)}
${shader(id, w, h)}
${windowChrome(id, tx, ty, tw, th, 'pixqr · zsh')}
  ${lines}
  <rect x="${tx + 20}" y="${ty + 84 + terminalSteps.length * 30 - 16}" width="8" height="15" rx="1" fill="${C.greenX}"><animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite"/></rect>
</svg>`;
}

const codeLines = [
  [['const', '#C084FC'], [' built = ', C.text], ['buildPixPayload', C.greenL], ['({', C.text]],
  [['  key: ', C.muted], ["'123.456.789-09'", '#A5E8BE'], [',', C.text]],
  [['  merchantName: ', C.muted], ["'Fulano de Tal'", '#A5E8BE'], [',', C.text]],
  [['  amount: ', C.muted], ['123.45', '#F0C870'], [',', C.text]],
  [['});', C.text]],
  [['', C.text]],
  [['const', '#C084FC'], [' png = ', C.text], ['await', '#C084FC'], [' toStyledQrPng', C.greenL], ['(built.', C.text], ['value', '#A5E8BE'], [', {', C.text]],
  [['  dark: ', C.muted], ["'#0a2a8a'", '#A5E8BE'], [',', C.text]],
  [['  logo: ', C.muted], ["'logo.png'", '#A5E8BE'], [',', C.text]],
  [['});', C.text]],
];

function exampleSvg() {
  const w = 1200;
  const h = 320;
  const id = 'code';
  const tx = 60;
  const ty = 44;
  const tw = w - 120;
  const th = h - 88;
  let lines = '';
  codeLines.forEach((parts, i) => {
    const y = ty + 84 + i * 17.5;
    let x = tx + 26;
    parts.forEach(([text], j) => {
      const width = text.length * 7.4 + 2;
      const start = 0.03 + i * 0.04;
      const clip = `${id}-c${i}-${j}`;
      lines += `
    <clipPath id="${clip}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y - 13}" width="0" height="18"><animate attributeName="width" values="0;0;${width};${width}" keyTimes="0;${start.toFixed(2)};${(start + 0.035).toFixed(2)};1" dur="9s" repeatCount="indefinite"/></rect></clipPath>`;
      x += width;
    });
    x = tx + 26;
    parts.forEach(([text, color], j) => {
      const width = text.length * 7.4 + 2;
      const clip = `${id}-c${i}-${j}`;
      lines += `
    <text x="${x}" y="${y}" fill="${color}" font-size="13.5" font-family="${MONO}" clip-path="url(#${clip})">${esc(text)}</text>`;
      x += width;
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="exemplo pix-qr-kit">
${defs(id, w, h)}
${shader(id, w, h)}
${windowChrome(id, tx, ty, tw, th, 'exemplo.ts')}
  ${lines}
</svg>`;
}

const dir = new URL('./', import.meta.url);
await writeFile(new URL('hero.svg', dir), heroSvg());
await writeFile(new URL('terminal.svg', dir), terminalSvg());
await writeFile(new URL('example.svg', dir), exampleSvg());
console.log('hero.svg, terminal.svg, example.svg gerados');
