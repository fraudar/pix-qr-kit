import type { ReconcileCharge, ReconcileEvent, ReconcileReport } from './types.js';

export type ReconcileOptions = {
  charges: ReconcileCharge[];
  events: ReconcileEvent[];
  toleranceCents?: number;
};

const FINAL_PAYMENT = 'payment.confirmed';

export function reconcile(options: ReconcileOptions): ReconcileReport {
  const tolerance = options.toleranceCents ?? 0;
  const charges = options.charges;
  const events = options.events;

  const byExternalId = new Map<string, ReconcileEvent[]>();
  for (const event of events) {
    const key = `${event.provider}:${event.externalId}`;
    const list = byExternalId.get(key) ?? [];
    list.push(event);
    byExternalId.set(key, list);
  }

  const duplicates = [...byExternalId.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, count: list.length, event: list[0]! }));

  const byTxid = new Map<string, ReconcileEvent[]>();
  const orphans: ReconcileEvent[] = [];
  for (const event of events) {
    if (!event.txid) {
      if (event.type === FINAL_PAYMENT) orphans.push(event);
      continue;
    }
    const list = byTxid.get(event.txid) ?? [];
    list.push(event);
    byTxid.set(event.txid, list);
  }

  const report: ReconcileReport = {
    matched: [],
    orphans,
    duplicates,
    amountMismatch: [],
    missing: [],
    totals: {
      charges: charges.length,
      events: events.length,
      matched: 0,
      orphans: orphans.length,
      duplicates: duplicates.length,
      amountMismatch: 0,
      missing: 0,
    },
  };

  for (const charge of charges) {
    const chargeEvents = byTxid.get(charge.txid) ?? [];
    const paid = chargeEvents.filter((event) => event.type === FINAL_PAYMENT);

    if (paid.length === 0) {
      report.missing.push(charge);
      continue;
    }

    const matching = paid.find((event) =>
      event.amountCents !== undefined &&
      Math.abs(event.amountCents - charge.amountCents) <= tolerance,
    );

    if (matching) {
      report.matched.push({ charge, event: matching });
      for (const orphanCandidate of chargeEvents) {
        const index = report.orphans.indexOf(orphanCandidate);
        if (index >= 0) report.orphans.splice(index, 1);
      }
      continue;
    }

    for (const event of paid) {
      report.amountMismatch.push({
        charge,
        event,
        deltaCents: (event.amountCents ?? 0) - charge.amountCents,
      });
      const index = report.orphans.indexOf(event);
      if (index >= 0) report.orphans.splice(index, 1);
    }
  }

  const knownTxids = new Set(charges.map((charge) => charge.txid));
  report.orphans = report.orphans.filter((event) => !event.txid || !knownTxids.has(event.txid));
  for (const [txid, chargeEvents] of byTxid) {
    if (knownTxids.has(txid)) continue;
    for (const event of chargeEvents) {
      if (event.type === FINAL_PAYMENT) report.orphans.push(event);
    }
  }

  report.totals.matched = report.matched.length;
  report.totals.orphans = report.orphans.length;
  report.totals.duplicates = report.duplicates.length;
  report.totals.amountMismatch = report.amountMismatch.length;
  report.totals.missing = report.missing.length;
  return report;
}
