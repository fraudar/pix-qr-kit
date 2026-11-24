import type { ChargeStore } from './store.js';
import type { HttpClient, PixEvent, PixWebhookAdapter, RawRequest } from './webhook.js';

export type HandlerOptions = {
  adapters: PixWebhookAdapter[];
  store: ChargeStore;
  http?: HttpClient;
  onEvent?: (event: PixEvent) => void | Promise<void>;
};

export type HandlerResult = {
  ok: boolean;
  status: 200 | 400 | 401;
  provider?: string;
  processed: PixEvent[];
  ignored: number;
  error?: string;
};

const SIGNATURE_FAILED = 'Webhook signature not recognized by any configured adapter';

export async function handleWebhookRequest(
  req: RawRequest,
  options: HandlerOptions,
): Promise<HandlerResult> {
  const adapter = options.adapters.find((candidate) => candidate.verify(req));
  if (!adapter) {
    return { ok: false, status: 401, processed: [], ignored: 0, error: SIGNATURE_FAILED };
  }

  let parsed: PixEvent[];
  try {
    parsed = adapter.parse(req);
  } catch (error) {
    return { ok: false, status: 400, processed: [], ignored: 0, error: (error as Error).message };
  }

  const processed: PixEvent[] = [];
  let ignored = 0;

  for (const incoming of parsed) {
    let events: PixEvent[] = [incoming];
    if (incoming.type === 'payment.pending_resolve') {
      if (!adapter.resolve || !options.http) {
        ignored++;
        continue;
      }
      try {
        events = await adapter.resolve(incoming, options.http);
      } catch (error) {
        return { ok: false, status: 400, processed, ignored, error: (error as Error).message };
      }
    }

    for (const event of events) {
      const recorded = await options.store.recordEvent(event);
      if (!recorded.inserted) {
        ignored++;
        await options.store.recordFinding({
          kind: 'duplicate',
          key: `${event.provider}:${event.externalId}`,
          message: 'Webhook redelivery ignored (idempotency key already stored)',
          createdAt: new Date().toISOString(),
          txid: event.txid,
          event,
        });
        continue;
      }

      const charge = event.txid ? await options.store.getByTxid(event.txid) : null;
      const now = new Date().toISOString();

      if (!charge) {
        await options.store.recordFinding({
          kind: 'orphan',
          key: `${event.provider}:${event.externalId}`,
          message: `No charge found for txid ${event.txid ?? '(missing)'}`,
          createdAt: now,
          txid: event.txid,
          event,
        });
        processed.push(event);
        await options.onEvent?.(event);
        continue;
      }

      if (event.type === 'payment.confirmed' && charge.amountCents !== event.amountCents) {
        await options.store.markCharge(charge.txid, { status: 'divergent', e2eid: event.e2eid });
        await options.store.recordFinding({
          kind: 'amount_mismatch',
          key: `${event.provider}:${event.externalId}`,
          message: `Expected ${charge.amountCents} cents, received ${event.amountCents} cents`,
          createdAt: now,
          txid: charge.txid,
          event,
        });
      } else if (event.type === 'payment.confirmed') {
        await options.store.markCharge(charge.txid, {
          status: 'confirmed',
          e2eid: event.e2eid,
          paidAt: event.paidAt,
        });
      } else if (event.type === 'payment.refunded') {
        await options.store.markCharge(charge.txid, { status: 'refunded' });
      } else if (event.type === 'charge.expired') {
        await options.store.markCharge(charge.txid, { status: 'expired' });
      }

      processed.push(event);
      await options.onEvent?.(event);
    }
  }

  return { ok: true, status: 200, provider: adapter.id, processed, ignored };
}
