import { crc16, splitCrc } from './crc.js';
import { decodeTlv, findNode } from './tlv.js';
import type { Issue, PixPayload, Result } from './types.js';
import { detectKey } from './validate.js';

export function parsePixPayload(payload: string): Result<PixPayload> {
  const issues: Issue[] = [];
  const trimmed = payload.replace(/[\r\n]+/g, '').trim();

  const split = splitCrc(trimmed);
  if (!split) {
    issues.push({ path: 'crc', code: 'missing_crc', message: 'Payload must end with ID 63 and a 4-char CRC' });
    return { ok: false, issues };
  }
  if (crc16(split.body) !== split.crc) {
    issues.push({ path: 'crc', code: 'crc_mismatch', message: `CRC mismatch: expected ${split.crc}, calculated ${crc16(split.body)}` });
  }

  let nodes;
  try {
    nodes = decodeTlv(trimmed);
  } catch (error) {
    issues.push({ path: 'payload', code: 'malformed_tlv', message: (error as Error).message });
    return { ok: false, issues };
  }

  const decodeNested = (value: string, path: string): ReturnType<typeof decodeTlv> => {
    try {
      return decodeTlv(value);
    } catch (error) {
      issues.push({ path, code: 'malformed_tlv', message: (error as Error).message });
      return [];
    }
  };

  const format = findNode(nodes, '00');
  if (format !== '01') issues.push({ path: '00', code: 'unsupported_format', message: `Expected payload format 01, got ${format ?? 'nothing'}` });

  const pixFields = decodeNested(findNode(nodes, '26') ?? '', '26');
  const gui = findNode(pixFields, '00');
  if (!gui || gui.toUpperCase() !== 'BR.GOV.BCB.PIX') {
    issues.push({ path: '26.00', code: 'not_pix', message: 'Merchant account GUI is not br.gov.bcb.pix' });
  }

  const keyRaw = findNode(pixFields, '01');
  const url = findNode(pixFields, '25');
  const pointOfInitiation = findNode(nodes, '01');
  const mode = url ? 'dynamic-url' : pointOfInitiation === '12' ? 'dynamic-key' : 'static';

  const amountRaw = findNode(nodes, '54');
  let amountCents: number | undefined;
  if (amountRaw !== undefined) {
    if (/^\d+(\.\d{1,2})?$/.test(amountRaw)) {
      const [reais, centavos = ''] = amountRaw.split('.');
      amountCents = Number(reais) * 100 + Number(centavos.padEnd(2, '0'));
    } else {
      issues.push({ path: '54', code: 'invalid_amount', message: `Invalid transaction amount: ${amountRaw}` });
    }
  }

  if (mode === 'dynamic-key' && amountCents === undefined) {
    issues.push({ path: '54', code: 'required', message: 'Dynamic Pix requires an amount' });
  }
  if (mode === 'dynamic-key' && !findNode(decodeNested(findNode(nodes, '62') ?? '', '62'), '05')) {
    issues.push({ path: '62.05', code: 'required', message: 'Dynamic Pix requires a txid' });
  }

  const name = findNode(nodes, '59');
  const city = findNode(nodes, '60');
  if (!name) issues.push({ path: '59', code: 'required', message: 'Merchant name is required' });
  if (!city) issues.push({ path: '60', code: 'required', message: 'Merchant city is required' });

  if (findNode(nodes, '53') !== '986') issues.push({ path: '53', code: 'invalid_currency', message: 'Currency must be 986 (BRL)' });
  if (findNode(nodes, '58') !== 'BR') issues.push({ path: '58', code: 'invalid_country', message: 'Country must be BR' });

  if (issues.length > 0) return { ok: false, issues };

  const value: PixPayload = {
    mode,
    merchant: {
      name: name!,
      city: city!,
      mcc: findNode(nodes, '52') ?? '0000',
    },
    currency: '986',
    country: 'BR',
    crc: split.crc,
    raw: trimmed,
  };
  if (keyRaw) value.key = detectKey(keyRaw);
  if (url) value.url = url;
  if (amountCents !== undefined) value.amountCents = amountCents;
  const txid = findNode(decodeNested(findNode(nodes, '62') ?? '', '62'), '05');
  if (txid) value.txid = txid;
  const description = findNode(pixFields, '02');
  if (description) value.description = description;

  return { ok: true, value };
}
