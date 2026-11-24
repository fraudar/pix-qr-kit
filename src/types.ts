export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'evp' | 'random';

export type PixKey = {
  type: PixKeyType;
  value: string;
  raw: string;
};

export type PixPayload = {
  mode: 'static' | 'dynamic-key' | 'dynamic-url';
  merchant: { name: string; city: string; mcc: string };
  currency: '986';
  country: 'BR';
  key?: PixKey;
  url?: string;
  amountCents?: number;
  txid?: string;
  description?: string;
  crc: string;
  raw: string;
};

export type Issue = { path: string; code: string; message: string };

export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export type ReconcileCharge = {
  txid: string;
  amountCents: number;
  status?: string;
  createdAt?: string;
};

export type ReconcileEvent = {
  provider: string;
  externalId: string;
  type: string;
  txid?: string;
  e2eid?: string;
  amountCents?: number;
  paidAt?: string;
};

export type ReconcileReport = {
  matched: Array<{ charge: ReconcileCharge; event: ReconcileEvent }>;
  orphans: ReconcileEvent[];
  duplicates: Array<{ key: string; count: number; event: ReconcileEvent }>;
  amountMismatch: Array<{ charge: ReconcileCharge; event: ReconcileEvent; deltaCents: number }>;
  missing: ReconcileCharge[];
  totals: {
    charges: number;
    events: number;
    matched: number;
    orphans: number;
    duplicates: number;
    amountMismatch: number;
    missing: number;
  };
};
