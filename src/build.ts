import { crc16 } from './crc.js';
import { encodeTlv } from './tlv.js';
import type { Issue, Result } from './types.js';
import {
  amountToCents,
  detectKey,
  normalizeAscii,
  validateDynamicUrl,
  validateKey,
} from './validate.js';

export type BuildInput = {
  merchantName: string;
  merchantCity: string;
  key?: string;
  url?: string;
  amount?: number;
  txid?: string;
  description?: string;
  mcc?: string;
  initiation?: 'static' | 'dynamic';
  strictKey?: boolean;
  allowPlaceholderTxid?: boolean;
};

export function buildPixPayload(input: BuildInput): Result<string> {
  const issues: Issue[] = [];

  if (!input.key && !input.url) {
    issues.push({ path: 'key', code: 'required', message: 'Provide a Pix key or a dynamic URL' });
  }

  const name = normalizeAscii(input.merchantName ?? '');
  const city = normalizeAscii(input.merchantCity ?? '');
  if (!name || name.length > 25) {
    issues.push({ path: 'merchantName', code: 'invalid_length', message: 'Merchant name must have 1..25 ASCII characters' });
  }
  if (!city || city.length > 15) {
    issues.push({ path: 'merchantCity', code: 'invalid_length', message: 'Merchant city must have 1..15 ASCII characters' });
  }

  const key = input.key ? detectKey(input.key) : undefined;
  if (key) issues.push(...validateKey(key, input.strictKey ?? false));
  if (input.url) issues.push(...validateDynamicUrl(input.url));

  let amountCents: number | undefined;
  if (input.amount !== undefined) {
    const cents = amountToCents(input.amount);
    if (cents === null) {
      issues.push({ path: 'amount', code: 'invalid_amount', message: 'Amount must be between 0.01 and 999999999.99' });
    } else {
      amountCents = cents;
    }
  }

  const txidPattern = input.allowPlaceholderTxid ? /^[A-Za-z0-9*]{1,25}$/ : /^[A-Za-z0-9]{1,25}$/;
  if (input.txid && !txidPattern.test(input.txid)) {
    issues.push({ path: 'txid', code: 'invalid_txid', message: 'txid must have 1..25 alphanumeric characters' });
  }

  const isDynamicUrl = Boolean(input.url);
  const isDynamic = input.initiation === 'dynamic' || isDynamicUrl;
  if (isDynamic && !input.txid && !isDynamicUrl) {
    issues.push({ path: 'txid', code: 'required', message: 'Dynamic Pix with a key requires a txid' });
  }
  if (isDynamic && amountCents === undefined && !isDynamicUrl) {
    issues.push({ path: 'amount', code: 'required', message: 'Dynamic Pix with a key requires an amount' });
  }
  if (isDynamicUrl && (input.amount !== undefined || input.txid)) {
    issues.push({ path: 'url', code: 'conflicting_fields', message: 'Dynamic URL payload cannot carry amount or txid' });
  }

  if (issues.length > 0) return { ok: false, issues };

  const parts: string[] = [encodeTlv('00', '01')];
  if (isDynamic) parts.push(encodeTlv('01', '12'));

  const pixFields = [encodeTlv('00', 'br.gov.bcb.pix')];
  if (isDynamicUrl) {
    pixFields.push(encodeTlv('25', input.url!));
  } else {
    pixFields.push(encodeTlv('01', key!.value));
    if (input.description) pixFields.push(encodeTlv('02', normalizeAscii(input.description)));
  }
  parts.push(encodeTlv('26', pixFields.join('')));
  parts.push(encodeTlv('52', input.mcc ?? '0000'));
  parts.push(encodeTlv('53', '986'));
  if (amountCents !== undefined) parts.push(encodeTlv('54', (amountCents / 100).toFixed(2)));
  parts.push(encodeTlv('58', 'BR'));
  parts.push(encodeTlv('59', name));
  parts.push(encodeTlv('60', city));
  if (input.txid) parts.push(encodeTlv('62', encodeTlv('05', input.txid)));
  parts.push(encodeTlv('63', '0000'));

  const body = parts.join('');
  const payload = body.slice(0, -4) + crc16(body.slice(0, -4));
  return { ok: true, value: payload };
}
