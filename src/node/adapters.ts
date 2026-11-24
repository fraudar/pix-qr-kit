import {
  bodyText,
  defineAdapter,
  header,
  hmacHex,
  obj,
  asString,
  asCents,
  parseBody,
  safeEqualHex,
  type HttpClient,
  type PixWebhookAdapter,
} from './webhook.js';

export function mercadopago(config: {
  webhookSecret: string;
  accessToken: string;
  baseUrl?: string;
}): PixWebhookAdapter {
  const baseUrl = config.baseUrl ?? 'https://api.mercadopago.com';

  return defineAdapter({
    id: 'mercadopago',
    verify(req) {
      const signature = header(req, 'x-signature') ?? '';
      const requestId = header(req, 'x-request-id') ?? '';
      const params = new Map(
        signature.split(',').map((part) => {
          const [key, value] = part.split('=');
          return [key?.trim() ?? '', value?.trim() ?? ''] as const;
        }),
      );
      const dataId = asString(obj(parseBodySafe(req).data).id) ?? '';
      const template = `id:${dataId};request-id:${requestId};ts:${params.get('ts') ?? ''};`;
      return safeEqualHex(hmacHex(config.webhookSecret, template), params.get('v1'));
    },
    parse(req) {
      const body = parseBody(req);
      const action = asString(body.action) ?? '';
      if (!action.startsWith('payment.')) return [];
      const id = asString(obj(body.data).id);
      if (!id) return [];
      return [
        {
          type: 'payment.pending_resolve',
          provider: 'mercadopago',
          externalId: id,
          providerRef: id,
          txid: undefined,
          raw: body,
        },
      ];
    },
    async resolve(event, http: HttpClient) {
      const payment = await http.get<Record<string, unknown>>(
        `${baseUrl}/v1/payments/${encodeURIComponent(event.providerRef ?? '')}`,
        { headers: { Authorization: `Bearer ${config.accessToken}` } },
      );
      if (payment.status !== 'approved') return [];
      const methodInfo = obj(payment.payment_method_info ?? payment.method_details);
      return [
        {
          type: 'payment.confirmed',
          provider: 'mercadopago',
          externalId: `${event.externalId}:${payment.id ?? 'payment'}`,
          e2eid: asString(methodInfo.external_resource_id),
          txid: asString(payment.external_reference),
          amountCents: asCents(payment.transaction_amount),
          paidAt: asString(payment.date_approved) ?? new Date().toISOString(),
          raw: payment,
        },
      ];
    },
  });
}

export function asaas(config: { webhookSecret: string }): PixWebhookAdapter {
  return defineAdapter({
    id: 'asaas',
    verify(req) {
      return safeEqualHex(hmacHex(config.webhookSecret, bodyText(req)), header(req, 'asaas-signature'));
    },
    parse(req) {
      const body = parseBody(req);
      const eventName = asString(body.event) ?? '';
      if (!['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED', 'PAYMENT_UPDATED'].includes(eventName)) return [];
      const payment = obj(body.payment);
      if (!['RECEIVED', 'CONFIRMED'].includes(asString(payment.status) ?? '')) return [];
      const externalId = asString(body.id) ?? `${eventName}:${asString(payment.id) ?? 'unknown'}`;
      return [
        {
          type: 'payment.confirmed',
          provider: 'asaas',
          externalId,
          e2eid: asString(payment.endToEndId),
          txid: asString(payment.externalReference),
          amountCents: asCents(payment.value),
          paidAt: asString(payment.confirmedDate) ?? asString(payment.paymentDate) ?? new Date().toISOString(),
          raw: body,
        },
      ];
    },
  });
}

export function pagbank(config: { webhookSecret: string }): PixWebhookAdapter {
  return defineAdapter({
    id: 'pagbank',
    verify(req) {
      const received = header(req, 'x-pagbank-signature') ?? header(req, 'signature');
      return safeEqualHex(hmacHex(config.webhookSecret, bodyText(req)), received);
    },
    parse(req) {
      const body = parseBody(req);
      const eventType = asString(body.eventType) ?? '';
      if (!['PAYMENT_CONFIRMED', 'PIX_PAYMENT_RECEIVED', 'PIX_RECEIVED'].includes(eventType)) return [];
      const resource = obj(body.resource ?? body.payment);
      const amount = obj(resource.amount);
      const externalId = asString(body.id) ?? asString(resource.id) ?? `${eventType}:${Date.now()}`;
      return [
        {
          type: 'payment.confirmed',
          provider: 'pagbank',
          externalId,
          e2eid: asString(resource.e2eId) ?? asString(resource.endToEndId),
          txid: asString(resource.txid) ?? asString(resource.reference),
          amountCents: asCents(amount.value ?? resource.value),
          paidAt: asString(resource.paymentDate) ?? new Date().toISOString(),
          raw: body,
        },
      ];
    },
  });
}

export function parseBodySafe(req: Parameters<typeof parseBody>[0]): Record<string, unknown> {
  try {
    return parseBody(req);
  } catch {
    return {};
  }
}
