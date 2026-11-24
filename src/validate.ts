import type { Issue, PixKey, PixKeyType } from './types.js';

export function normalizeAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function charValue(char: string, cnpj: boolean): number {
  return cnpj ? char.charCodeAt(0) - 48 : Number(char);
}

function validCheckDigit(cnpj: boolean, value: string): boolean {
  const weights = cnpj ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const len = cnpj ? 12 : 9;
  let total = 0;
  for (let i = 0; i < len; i++) total += charValue(value[i] ?? '', cnpj) * (weights[i] ?? 0);
  const first = total % 11;
  const d1 = first < 2 ? 0 : 11 - first;
  if (Number(value[len]) !== d1) return false;

  const weights2 = cnpj ? [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const len2 = cnpj ? 13 : 10;
  let total2 = 0;
  for (let i = 0; i < len2; i++) total2 += charValue(value[i] ?? '', cnpj) * (weights2[i] ?? 0);
  const second = total2 % 11;
  const d2 = second < 2 ? 0 : 11 - second;
  return Number(value[len2]) === d2;
}

export function normalizeCnpj(input: string): string {
  return input.toUpperCase().replace(/[./\s-]/g, '');
}

export function detectKey(input: string): PixKey {
  const raw = input.trim();
  let type: PixKeyType = 'random';
  let value = raw;

  if (/^\d{11}$/.test(digits(raw)) && raw.replace(/\D/g, '').length === 11) {
    type = 'cpf';
    value = digits(raw);
  } else if (/^\d{14}$/.test(digits(raw)) && raw.replace(/\D/g, '').length === 14) {
    type = 'cnpj';
    value = digits(raw);
  } else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
    type = 'email';
  } else if (/^\+55\d{10,11}$/.test('+' + digits(raw)) && raw.startsWith('+')) {
    type = 'phone';
    value = '+' + digits(raw);
  } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    type = 'evp';
  } else {
    const cnpj = normalizeCnpj(raw);
    if (/^[0-9A-Z]{14}$/.test(cnpj) && /[A-Z]/.test(cnpj) && /^\d{2}$/.test(cnpj.slice(12))) {
      type = 'cnpj';
      value = cnpj;
    }
  }

  return { type, value, raw };
}

export function validateKey(key: PixKey, strictCheckDigits = false): Issue[] {
  const issues: Issue[] = [];
  if (!key.value || key.value.length > 77) {
    issues.push({ path: 'key', code: 'invalid_length', message: 'Pix key must have 1..77 characters' });
  }
  if (key.type === 'cnpj' && !/^\d{14}$|^[0-9A-Z]{14}$/.test(key.value)) {
    issues.push({ path: 'key', code: 'invalid_cnpj_format', message: 'CNPJ must be 14 digits or 12 base characters from 0-9/A-Z plus 2 numeric digits' });
  }
  if (strictCheckDigits && (key.type === 'cpf' || key.type === 'cnpj')) {
    if (!validCheckDigit(key.type === 'cnpj', key.value)) {
      issues.push({ path: 'key', code: 'invalid_check_digit', message: `${key.type.toUpperCase()} check digits do not match` });
    }
  }
  return issues;
}

export function validateDynamicUrl(url: string): Issue[] {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    return [{ path: 'url', code: 'scheme_not_allowed', message: 'Dynamic Pix URL must not include a scheme' }];
  }
  if (/[?\s]/.test(url)) {
    return [{ path: 'url', code: 'query_not_allowed', message: 'Dynamic Pix URL must not include query or whitespace' }];
  }
  if (url.length > 77) {
    return [{ path: 'url', code: 'too_long', message: 'Dynamic Pix URL exceeds 77 characters' }];
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/[^#]*)?$/i.test(url)) {
    return [{ path: 'url', code: 'invalid_host', message: 'Dynamic Pix URL needs a dotted host' }];
  }
  return [];
}

export function amountToCents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  if (cents > 9_999_999_999) return null;
  return cents;
}

export function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
