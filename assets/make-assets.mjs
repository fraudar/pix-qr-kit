import { writeFile } from 'node:fs/promises';

// Um só sistema visual para todos os assets do README: preto e branco, cartão
// chapado, tipografia mono. Nada de gradiente, ruído ou fundo animado.
const C = {
  canvas: '#0A0A0A',
  surface: '#141414',
  border: 'rgba(245,245,245,0.13)',
  line: 'rgba(245,245,245,0.08)',
  text: '#F5F5F5',
  strong: '#FFFFFF',
  body: 'rgba(245,245,245,0.80)',
  dim: 'rgba(245,245,245,0.45)',
  faint: 'rgba(245,245,245,0.32)',
  dot1: '#4A4A4A',
  dot2: '#6B6B6B',
  dot3: '#8F8F8F',
};

const VERSION = 'v1.0.0';
const MONO = "ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace";
const SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif";
const ADVANCE = 7.15; // px por caractere em mono 13

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clip = (text, max) => (text.length <= max ? text : text.slice(0, max - 1) + '…');

function windowChrome(x, y, w, h, label) {
  const titleH = 36;
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${C.surface}" stroke="${C.border}"/>
  <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${titleH - 1}" rx="13" fill="rgba(245,245,245,0.03)"/>
  <line x1="${x}" y1="${y + titleH}" x2="${x + w}" y2="${y + titleH}" stroke="${C.line}"/>
  <circle cx="${x + 22}" cy="${y + 18}" r="4.5" fill="${C.dot1}"/>
  <circle cx="${x + 40}" cy="${y + 18}" r="4.5" fill="${C.dot2}"/>
  <circle cx="${x + 58}" cy="${y + 18}" r="4.5" fill="${C.dot3}"/>
  <text x="${x + w / 2}" y="${y + 22}" text-anchor="middle" fill="${C.faint}" font-size="11.5" font-family="${MONO}">${esc(label)}</text>`;
}

// Caret que acompanha o texto revelado e pisca no fim.
function caret(x, y, advance, start, end, cycle) {
  const s = (start / cycle).toFixed(4);
  const e = (end / cycle).toFixed(4);
  return `
  <g opacity="0"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;${s};${Number(s) + 0.002};1" dur="${cycle}s" repeatCount="indefinite"/>
    <rect x="${x}" y="${y}" width="6.5" height="13" rx="1.5" fill="${C.strong}">
      <animate attributeName="x" values="${x};${x};${x + advance + 1};${x + advance + 1}" keyTimes="0;${s};${e};1" dur="${cycle}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.9;0.12;0.9" dur="1.1s" repeatCount="indefinite"/>
    </rect>
  </g>`;
}

const heroLines = [
  { kind: 'cmd', text: clip('pixqr build --key 123.456', 30) },
  { kind: 'ok', text: clip('000201010212...6304ABCD', 30) },
  { kind: 'info', text: clip(`pix-qr-kit ${VERSION}`, 30) },
];

function heroSvg() {
  const w = 760;
  const h = 264;
  const tx = 428;
  const ty = 30;
  const tw = 300;
  const th = 192;
  const cycle = 9;
  let lines = '';
  heroLines.forEach((l, i) => {
    const y = ty + 70 + i * 32;
    const start = 1 + i * 1.6;
    const end = start + 0.3 + l.text.length * 0.035;
    const advance = l.text.length * ADVANCE;
    const id = `hero-c${i}`;
    const mark = l.kind === 'cmd' ? '$' : l.kind === 'ok' ? '✓' : '↳';
    const markColor = l.kind === 'cmd' ? C.text : l.kind === 'ok' ? C.body : C.faint;
    const textColor = l.kind === 'cmd' ? C.body : l.kind === 'ok' ? C.body : C.dim;
    const markSize = l.kind === 'ok' ? 11.5 : 12.5;
    lines += `
    <text x="${tx + 20}" y="${y}" fill="${markColor}" font-size="${markSize}" font-family="${MONO}">${mark}</text>
    <clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${tx + 40}" y="${y - 14}" width="0" height="19"><animate attributeName="width" values="0;0;${advance + 8};${advance + 8}" keyTimes="0;${(start / cycle).toFixed(4)};${(end / cycle).toFixed(4)};1" dur="${cycle}s" repeatCount="indefinite"/></rect></clipPath>
    <text x="${tx + 40}" y="${y}" fill="${textColor}" font-size="12.5" font-family="${MONO}" clip-path="url(#${id})">${esc(l.text)}</text>`;
    if (i === heroLines.length - 1) lines += caret(tx + 40, y - 11, advance, start, end, cycle);
  });

  const pillW = VERSION.length * 7.4 + 26;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="pix-qr-kit banner">
  <rect width="${w}" height="${h}" fill="${C.canvas}"/>
  <rect x="0" y="0" width="2" height="${h}" fill="${C.strong}" opacity="0.5"/>
  <text x="40" y="112" fill="${C.strong}" font-size="46" font-family="${SANS}" font-weight="800" letter-spacing="-1.9">pix-qr-kit</text>
  <text x="41" y="142" fill="${C.dim}" font-size="14.5" font-family="${SANS}">BR Code Pix em TypeScript — gere, valide e concilie</text>
  <rect x="40" y="162" width="${pillW}" height="27" rx="13.5" fill="rgba(245,245,245,0.06)" stroke="rgba(245,245,245,0.32)"/>
  <text x="${40 + pillW / 2}" y="180" text-anchor="middle" fill="${C.text}" font-size="12" font-family="${MONO}" font-weight="600">${VERSION}</text>
  <text x="${40 + pillW + 18}" y="180" fill="${C.faint}" font-size="12.5" font-family="${SANS}">por fraudar · MIT</text>
${windowChrome(tx, ty, tw, th, 'pixqr · zsh')}
  ${lines}
</svg>`;
}

const terminalSteps = [
  { kind: 'cmd', text: 'npm run pixqr -- build --key 123.456.789-09 --amount 123.45' },
  { kind: 'ok', text: '0002010102122633...6304ABCD  CRC ok' },
  { kind: 'cmd', text: 'npm run pixqr -- qr --payload 000201... --styled' },
  { kind: 'ok', text: 'PNG 640px · payload decodificado' },
  { kind: 'cmd', text: 'npm test' },
  { kind: 'ok', text: '27 passed (3 files) · tsc limpo' },
];

function terminalSvg() {
  const w = 760;
  const tx = 28;
  const ty = 24;
  const tw = w - 56;
  const rowH = 27;
  const th = 36 + terminalSteps.length * rowH + 30;
  const h = th + ty * 2;
  const cycle = 10;
  let lines = '';
  terminalSteps.forEach((l, i) => {
    const y = ty + 36 + 22 + i * rowH;
    const start = 0.8 + i * 1.45;
    const end = start + 0.3 + l.text.length * 0.03;
    const advance = l.text.length * ADVANCE;
    const id = `term-c${i}`;
    const mark = l.kind === 'cmd' ? '$' : '✓';
    lines += `
    <text x="${tx + 20}" y="${y}" fill="${l.kind === 'cmd' ? C.text : C.body}" font-size="12.5" font-family="${MONO}">${mark}</text>
    <clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${tx + 40}" y="${y - 14}" width="0" height="19"><animate attributeName="width" values="0;0;${advance + 8};${advance + 8}" keyTimes="0;${(start / cycle).toFixed(4)};${(end / cycle).toFixed(4)};1" dur="${cycle}s" repeatCount="indefinite"/></rect></clipPath>
    <text x="${tx + 40}" y="${y}" fill="${l.kind === 'cmd' ? C.body : C.dim}" font-size="12.5" font-family="${MONO}" clip-path="url(#${id})">${esc(l.text)}</text>`;
    if (i === terminalSteps.length - 1) lines += caret(tx + 40, y - 11, advance, start, end, cycle);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="terminal pixqr">
  <rect width="${w}" height="${h}" fill="${C.canvas}"/>
${windowChrome(tx, ty, tw, th, 'pixqr · zsh')}
  ${lines}
</svg>`;
}

const codeLines = [
  [['const ', 'kw'], ['built', 'id'], [' = ', 'pun'], ['buildPixPayload', 'fn'], ['({', 'pun']],
  [['  key', 'prop'], [': ', 'pun'], ["'123.456.789-09'", 'str'], [',', 'pun']],
  [['  merchantName', 'prop'], [': ', 'pun'], ["'Fulano de Tal'", 'str'], [',', 'pun']],
  [['  amount', 'prop'], [': ', 'pun'], ['123.45', 'num'], [',', 'pun']],
  [['});', 'pun']],
  [['', 'pun']],
  [['const ', 'kw'], ['png', 'id'], [' = ', 'pun'], ['await', 'kw'], [' toStyledQrPng', 'fn'], ['(built.value, {', 'pun']],
  [['  dark', 'prop'], [': ', 'pun'], ["'#0a2a8a'", 'str'], [',', 'pun']],
  [['  logo', 'prop'], [': ', 'pun'], ["'logo.png'", 'str'], [',', 'pun']],
  [['});', 'pun']],
];

const tokenColor = {
  kw: C.strong,
  fn: C.text,
  id: C.strong,
  str: 'rgba(245,245,245,0.55)',
  num: C.strong,
  prop: 'rgba(245,245,245,0.45)',
  pun: 'rgba(245,245,245,0.72)',
};

function exampleSvg() {
  const w = 760;
  const tx = 28;
  const ty = 24;
  const tw = w - 56;
  const rowH = 19;
  const th = 36 + codeLines.length * rowH + 34;
  const h = th + ty * 2;
  let lines = '';
  codeLines.forEach((parts, i) => {
    const y = ty + 36 + 24 + i * rowH;
    // tspans deixam o próprio renderizador avançar: nenhuma conta de largura.
    const spans = parts
      .map(([text, kind]) => `<tspan fill="${tokenColor[kind]}">${esc(text)}</tspan>`)
      .join('');
    lines += `
    <text x="${tx + 22}" y="${y}" font-size="13" font-family="${MONO}" xml:space="preserve">${spans}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="exemplo pix-qr-kit">
  <rect width="${w}" height="${h}" fill="${C.canvas}"/>
${windowChrome(tx, ty, tw, th, 'exemplo.ts')}
  ${lines}
</svg>`;
}

const dir = new URL('./', import.meta.url);
await writeFile(new URL('hero.svg', dir), heroSvg());
await writeFile(new URL('terminal.svg', dir), terminalSvg());
await writeFile(new URL('example.svg', dir), exampleSvg());
console.log('hero.svg, terminal.svg, example.svg gerados');
