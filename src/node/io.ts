import type { ReconcileCharge, ReconcileEvent, ReconcileReport } from '../types.js';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  row.push(field.replace(/\r$/, ''));
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Record<string, unknown>>, headers?: string[]): string {
  const keys = headers ?? Object.keys(rows[0] ?? {});
  const lines = [keys.join(',')];
  for (const row of rows) lines.push(keys.map((key) => csvCell(row[key])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function loadChargesCsv(text: string): ReconcileCharge[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const column = (name: string) => header.findIndex((value) => value.trim().toLowerCase() === name);
  const txidIndex = column('txid');
  const amountIndex = column('amountcents');
  if (txidIndex < 0 || amountIndex < 0) {
    throw new Error('Charges CSV must have txid and amountCents columns');
  }
  return rows.map((row) => ({
    txid: row[txidIndex]?.trim() ?? '',
    amountCents: Number(row[amountIndex]),
    status: row[column('status')]?.trim() || undefined,
    createdAt: row[column('createdat')]?.trim() || undefined,
  }));
}

export function loadEventsNdjson(text: string): ReconcileEvent[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReconcileEvent);
}

export function reportToCsv(report: ReconcileReport): string {
  const rows: Array<Record<string, unknown>> = [];
  for (const item of report.matched) {
    rows.push({ kind: 'matched', key: item.charge.txid, detail: `e2eid=${item.event.e2eid ?? '-'}` });
  }
  for (const item of report.amountMismatch) {
    rows.push({ kind: 'amount_mismatch', key: item.charge.txid, detail: `deltaCents=${item.deltaCents}` });
  }
  for (const event of report.orphans) {
    rows.push({ kind: 'orphan', key: event.txid ?? event.externalId, detail: event.provider });
  }
  for (const item of report.duplicates) {
    rows.push({ kind: 'duplicate', key: item.key, detail: `count=${item.count}` });
  }
  for (const charge of report.missing) {
    rows.push({ kind: 'missing', key: charge.txid, detail: `amountCents=${charge.amountCents}` });
  }
  return toCsv(rows, ['kind', 'key', 'detail']);
}
