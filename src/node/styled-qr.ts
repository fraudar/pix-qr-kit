import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const jsQR = require('jsqr') as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => { data: string } | null;

export type StyledQrOptions = {
  size?: number;
  margin?: number;
  dark?: string;
  light?: string;
  accent?: string;
  logo?: string | Buffer;
  logoRatio?: number;
  rounded?: boolean;
  validate?: boolean;
};

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

async function logoBuffer(logo: string | Buffer): Promise<Buffer | null> {
  if (Buffer.isBuffer(logo)) return logo;
  try {
    if (/^https?:\/\//i.test(logo)) {
      const response = await fetch(logo);
      return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    }
    return await readFile(logo);
  } catch {
    return null;
  }
}

export async function toStyledQrPng(payload: string, options: StyledQrOptions = {}): Promise<Buffer> {
  if (!payload.trim()) throw new Error('payload vazio');

  const size = options.size ?? 1024;
  const margin = options.margin ?? 4;
  const dark = options.dark ?? '#0a2a8a';
  const light = options.light ?? '#ffffff';
  const accent = options.accent ?? '#1a6fbf';
  const logoRatio = options.logoRatio ?? 0.14;
  const rounded = options.rounded ?? true;

  const qr = QRCode.create(payload, { errorCorrectionLevel: 'H' });
  const modules = qr.modules.size;
  const data = qr.modules.data;
  const total = modules + margin * 2;
  const unit = Math.floor(size / total);
  const offset = Math.floor((size - unit * total) / 2);

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, size, size);

  const icon = options.logo ? await logoBuffer(options.logo) : null;
  const iconSize = Math.floor(size * logoRatio);
  const gap = iconSize * 1.25;
  const center = size / 2;

  const isFinder = (row: number, col: number): boolean =>
    (row < 7 && col < 7) || (row < 7 && col >= modules - 7) || (row >= modules - 7 && col < 7);

  const moduleWidth = unit * 0.96;
  const radius = unit * 0.12;
  const inset = (unit - moduleWidth) / 2;

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (data[row * modules + col] !== 1 || isFinder(row, col)) continue;
      const x = offset + (margin + col) * unit;
      const y = offset + (margin + row) * unit;
      if (icon && Math.abs(x + unit / 2 - center) < gap / 2 && Math.abs(y + unit / 2 - center) < gap / 2) continue;
      roundRect(ctx, x + inset, y + inset, moduleWidth, moduleWidth, rounded ? radius : 0, dark);
    }
  }

  const finderGradient = ctx.createLinearGradient(0, 0, size, 0);
  finderGradient.addColorStop(0, dark);
  finderGradient.addColorStop(1, accent);

  for (const [row, col] of [[0, 0], [modules - 7, 0], [0, modules - 7]] as const) {
    const x = offset + (margin + col) * unit;
    const y = offset + (margin + row) * unit;
    roundRect(ctx, x, y, unit * 7, unit * 7, unit * 1.7, finderGradient);
    roundRect(ctx, x + unit, y + unit, unit * 5, unit * 5, unit * 1.1, light);
    roundRect(ctx, x + unit * 2, y + unit * 2, unit * 3, unit * 3, unit * 0.75, finderGradient);
  }

  if (icon) {
    try {
      roundRect(ctx, center - gap / 2, center - gap / 2, gap, gap, gap * 0.18, light);
      const image = await loadImage(icon);
      const scale = Math.min(iconSize / image.width, iconSize / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      ctx.drawImage(image, center - width / 2, center - height / 2, width, height);
    } catch {}
  }

  if (options.validate !== false) {
    const image = ctx.getImageData(0, 0, size, size);
    const decoded = jsQR(image.data, size, size, { inversionAttempts: 'dontInvert' })
      ?? jsQR(image.data, size, size, { inversionAttempts: 'attemptBoth' });
    if (!decoded || decoded.data !== payload) throw new Error('QR gerado não decodifica de volta ao payload');
  }

  return canvas.toBuffer('image/png');
}
