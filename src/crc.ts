const POLYNOMIAL = 0x1021;
const INITIAL = 0xffff;

function step(crc: number, byte: number): number {
  let next = crc ^ (byte << 8);
  for (let bit = 0; bit < 8; bit++) {
    next = next & 0x8000 ? ((next << 1) ^ POLYNOMIAL) & 0xffff : (next << 1) & 0xffff;
  }
  return next;
}

export function crc16(payload: string): string {
  let crc = INITIAL;
  for (let i = 0; i < payload.length; i++) crc = step(crc, payload.charCodeAt(i) & 0xff);
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export type CrcStep = {
  position: number;
  byte: number;
  index: number;
  table: number;
  crc: number;
};

export function crc16Trace(payload: string): CrcStep[] {
  let crc = INITIAL;
  const steps: CrcStep[] = [];
  for (let i = 0; i < payload.length; i++) {
    const byte = payload.charCodeAt(i) & 0xff;
    const index = ((crc >> 8) ^ byte) & 0xff;
    const table = step(index << 8, 0);
    crc = step(crc, byte);
    steps.push({ position: i + 1, byte, index, table, crc });
  }
  return steps;
}

export function splitCrc(payload: string): { body: string; crc: string } | null {
  const tail = payload.slice(-8);
  if (!/^6304[0-9A-Fa-f]{4}$/.test(tail)) return null;
  return { body: payload.slice(0, -4), crc: tail.slice(-4).toUpperCase() };
}
