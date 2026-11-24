import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ReconcileEvent } from '../types.js';

export type RawRequest = {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
};

export type HttpClient = {
  get<T = unknown>(url: string, options?: { headers?: Record<string, string> }): Promise<T>;
};

export type PixEvent = ReconcileEvent & {
  type:
    | 'payment.confirmed'
    | 'payment.refunded'
    | 'charge.expired'
    | 'payment.pending_resolve';
  provider: string;
  externalId: string;
  raw: unknown;
  providerRef?: string;
  refundedAt?: string;
};

export type PixWebhookAdapter = {
  id: string;
  verify(req: RawRequest): boolean;
  parse(req: RawRequest): PixEvent[];
  resolve?(event: PixEvent, http: HttpClient): Promise<PixEvent[]>;
};

export function defineAdapter(adapter: PixWebhookAdapter): PixWebhookAdapter {
  return adapter;
}

export function header(req: RawRequest, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() !== target) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

export function bodyText(req: RawRequest): string {
  return Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : req.rawBody;
}

export function hmacHex(secret: string, payload: string | Buffer): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqualHex(expected: string, received: string | undefined): boolean {
  if (!received || !/^[0-9a-fA-F]+$/.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

export function parseBody(req: RawRequest): Record<string, unknown> {
  const parsed: unknown = JSON.parse(bodyText(req));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as Record<string, unknown>;
}

export function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asCents(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function asString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value);
}
