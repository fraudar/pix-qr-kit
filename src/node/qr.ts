import { writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';

export type QrOptions = {
  size?: number;
  margin?: number;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
  dark?: string;
  light?: string;
};

function qrOptions(options: QrOptions = {}) {
  return {
    width: options.size ?? 512,
    margin: options.margin ?? 2,
    errorCorrectionLevel: options.errorCorrection ?? 'M',
    color: {
      dark: options.dark ?? '#000000',
      light: options.light ?? '#FFFFFF',
    },
  };
}

export function toQrSvg(payload: string, options: QrOptions = {}): Promise<string> {
  return QRCode.toString(payload, { type: 'svg', ...qrOptions(options) });
}

export function toQrPng(payload: string, options: QrOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(payload, { type: 'png', ...qrOptions(options) });
}

export async function writeQr(payload: string, file: string, options: QrOptions = {}): Promise<void> {
  if (file.toLowerCase().endsWith('.svg')) {
    await writeFile(file, await toQrSvg(payload, options), 'utf8');
    return;
  }
  await writeFile(file, await toQrPng(payload, options));
}
