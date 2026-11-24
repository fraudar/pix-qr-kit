import type { ReconcileCharge } from '../types.js';
import type { PixEvent } from './webhook.js';

export type ChargeStatus =
  | 'pending'
  | 'confirmed'
  | 'reconciled'
  | 'divergent'
  | 'orphan'
  | 'expired'
  | 'refunded';

export type Charge = ReconcileCharge & {
  status: ChargeStatus;
  e2eid?: string;
  paidAt?: string;
  updatedAt?: string;
};

export type Finding = {
  kind: 'orphan' | 'amount_mismatch' | 'duplicate' | 'missing';
  key: string;
  message: string;
  createdAt: string;
  txid?: string;
  event?: PixEvent;
};

export type RecordEventResult = { inserted: boolean; event: PixEvent };

export interface ChargeStore {
  getByTxid(txid: string): Promise<Charge | null>;
  recordEvent(event: PixEvent): Promise<RecordEventResult>;
  markCharge(txid: string, patch: Partial<Charge>): Promise<void>;
  recordFinding(finding: Finding): Promise<void>;
  listCharges(): Promise<Charge[]>;
  listEvents(): Promise<PixEvent[]>;
  listFindings(): Promise<Finding[]>;
}

export function eventKey(event: PixEvent): string {
  return `${event.provider}:${event.externalId}`;
}

export class InMemoryChargeStore implements ChargeStore {
  private readonly charges = new Map<string, Charge>();
  private readonly events = new Map<string, PixEvent>();
  private readonly findings: Finding[] = [];

  seed(charges: ReconcileCharge[]): this {
    for (const charge of charges) {
      this.charges.set(charge.txid, { ...charge, status: charge.status as ChargeStatus ?? 'pending' });
    }
    return this;
  }

  async getByTxid(txid: string): Promise<Charge | null> {
    return this.charges.get(txid) ?? null;
  }

  async recordEvent(event: PixEvent): Promise<RecordEventResult> {
    const key = eventKey(event);
    if (this.events.has(key)) return { inserted: false, event: this.events.get(key)! };
    this.events.set(key, event);
    return { inserted: true, event };
  }

  async markCharge(txid: string, patch: Partial<Charge>): Promise<void> {
    const charge = this.charges.get(txid);
    if (!charge) return;
    this.charges.set(txid, { ...charge, ...patch, updatedAt: new Date().toISOString() });
  }

  async recordFinding(finding: Finding): Promise<void> {
    this.findings.push(finding);
  }

  async listCharges(): Promise<Charge[]> {
    return [...this.charges.values()];
  }

  async listEvents(): Promise<PixEvent[]> {
    return [...this.events.values()];
  }

  async listFindings(): Promise<Finding[]> {
    return [...this.findings];
  }
}
