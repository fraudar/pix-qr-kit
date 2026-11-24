#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { buildPixPayload } from '../src/build.js';
import { crc16, crc16Trace, splitCrc } from '../src/crc.js';
import { parsePixPayload } from '../src/parse.js';
import { reconcile } from '../src/reconcile.js';
import { asaas, mercadopago, pagbank } from '../src/node/adapters.js';
import { handleWebhookRequest } from '../src/node/handler.js';
import { loadChargesCsv, loadEventsNdjson, reportToCsv } from '../src/node/io.js';
import { InMemoryChargeStore } from '../src/node/store.js';
import type { PixWebhookAdapter, RawRequest } from '../src/node/webhook.js';

type Args = Record<string, string | boolean>;

function readArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token?.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function print(value: unknown, pretty = true): void {
  console.log(pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value));
}

function fail(issues: unknown): never {
  print({ ok: false, issues }, true);
  process.exit(1);
}

function positional(rest: string[]): string | undefined {
  return rest.find((token) => !token.startsWith('--'));
}

async function buildAdapter(name: string, args: Args): Promise<PixWebhookAdapter> {
  const secret = process.env[String(args['secret-env'] ?? '')] ?? String(args.secret ?? '');
  if (!secret) throw new Error('Provide --secret-env VAR or --secret <value>');
  const token = process.env[String(args['token-env'] ?? '')] ?? String(args.token ?? '');

  if (name === 'mercadopago') {
    return mercadopago({ webhookSecret: secret, accessToken: token || 'not-needed-for-verify' });
  }
  if (name === 'asaas') return asaas({ webhookSecret: secret });
  if (name === 'pagbank') return pagbank({ webhookSecret: secret });
  throw new Error(`Unknown provider: ${name}`);
}

async function readWebhookRequest(args: Args): Promise<RawRequest> {
  const file = String(args.file ?? '');
  if (!file) throw new Error('Provide --file <webhook.json>');
  const rawBody = await readFile(file, 'utf8');
  const headers: Record<string, string> = {};
  for (const entry of String(args.headers ?? '').split(',').filter(Boolean)) {
    const [key, ...rest] = entry.split(':');
    if (key) headers[key.trim()] = rest.join(':').trim();
  }
  return { rawBody, headers };
}

async function main(): Promise<void> {
  const [command, subcommand, ...rest] = process.argv.slice(2);
  const args = readArgs(process.argv.slice(3));
  const pretty = Boolean(args.pretty);

  if (command === 'build') {
    const result = buildPixPayload({
      merchantName: String(args.name ?? ''),
      merchantCity: String(args.city ?? ''),
      key: args.key ? String(args.key) : undefined,
      url: args.url ? String(args.url) : undefined,
      amount: args.amount !== undefined ? Number(args.amount) : undefined,
      txid: args.txid ? String(args.txid) : undefined,
      description: args.description ? String(args.description) : undefined,
      initiation: args.dynamic ? 'dynamic' : 'static',
      strictKey: Boolean(args.strictKey),
      allowPlaceholderTxid: Boolean(args.placeholder),
    });
    if (!result.ok) fail(result.issues);
    if (pretty) print({ ok: true, payload: result.value });
    else console.log(result.value);
    return;
  }

  if (command === 'parse') {
    const payload = String(positional(process.argv.slice(3)) ?? '');
    const result = parsePixPayload(payload);
    if (!result.ok) fail(result.issues);
    print(result.value);
    return;
  }

  if (command === 'crc') {
    const payload = String(positional(process.argv.slice(3)) ?? '');
    const split = splitCrc(payload);
    if (!split) fail([{ path: 'crc', code: 'missing_crc', message: 'Payload must end with 6304XXXX' }]);
    const calculated = crc16(split!.body);
    const result: Record<string, unknown> = { calculated, embedded: split!.crc, valid: calculated === split!.crc };
    if (args.explain) result.steps = crc16Trace(split!.body);
    print(result);
    return;
  }

  if (command === 'qr') {
    const payloadArg = args.payload ? String(args.payload) : args.in ? await readFile(String(args.in), 'utf8') : '';
    const payload = payloadArg.trim();
    if (!payload) throw new Error('Provide --payload <code> or --in <file>');
    const options = {
      size: args.size ? Number(args.size) : 512,
      margin: args.margin ? Number(args.margin) : 2,
    };
    const out = args.out ? String(args.out) : undefined;
    if (args.styled) {
      const { toStyledQrPng } = await import('../src/node/styled-qr.js');
      const image = await toStyledQrPng(payload, {
        size: options.size,
        margin: options.margin,
        dark: args.dark ? String(args.dark) : undefined,
        light: args.light ? String(args.light) : undefined,
        accent: args.accent ? String(args.accent) : undefined,
        logo: args.logo ? String(args.logo) : undefined,
        logoRatio: args.logoRatio ? Number(args.logoRatio) : undefined,
      });
      if (out) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(out, image);
        print({ ok: true, file: out, bytes: image.length, valid: true });
      } else {
        process.stdout.write(image);
      }
      return;
    }
    const { writeQr, toQrSvg, toQrPng } = await import('../src/node/qr.js');
    if (out) {
      await writeQr(payload, out, options);
      print({ ok: true, file: out });
    } else if (args.svg) {
      console.log(await toQrSvg(payload, options));
    } else {
      process.stdout.write(await toQrPng(payload, options));
    }
    return;
  }

  if (command === 'webhook' && subcommand === 'verify') {
    const adapter = await buildAdapter(String(args.provider ?? ''), args);
    const req = await readWebhookRequest(args);
    print({ ok: true, provider: adapter.id, signatureValid: adapter.verify(req) });
    return;
  }

  if (command === 'webhook' && subcommand === 'handle') {
    const adapter = await buildAdapter(String(args.provider ?? ''), args);
    const req = await readWebhookRequest(args);
    const charges = loadChargesCsv(await readFile(String(args.charges), 'utf8'));
    const store = new InMemoryChargeStore().seed(charges);
    const result = await handleWebhookRequest(req, { adapters: [adapter], store });
    print({
      ...result,
      charges: await store.listCharges(),
      findings: await store.listFindings(),
    });
    return;
  }

  if (command === 'reconcile') {
    const charges = loadChargesCsv(await readFile(String(args.charges), 'utf8'));
    const events = loadEventsNdjson(await readFile(String(args.events), 'utf8'));
    const report = reconcile({
      charges,
      events,
      toleranceCents: args.tolerance ? Number(args.tolerance) : 0,
    });
    const content = args.format === 'csv' ? reportToCsv(report) : JSON.stringify(report, null, 2);
    const out = args.out ? String(args.out) : undefined;
    if (out) {
      await writeFile(out, content, 'utf8');
      print({ ok: true, file: out, totals: report.totals });
    } else if (args.format === 'csv') {
      process.stdout.write(content);
    } else {
      print(report);
    }
    return;
  }

  console.log('pixqr <command> [options]');
  console.log('  build    --key <chave> --name <nome> --city <cidade> [--amount 123.45] [--txid ABC] [--dynamic]');
  console.log('  build    --url pix.exemplo.com/qr/abc --name <nome> --city <cidade>');
  console.log('  parse    <payload>');
  console.log('  crc      <payload> [--explain]  (mostra o registro do CRC byte a byte)');
  console.log('  qr       --payload <code> | --in <file> [--out pix.png|pix.svg] [--size 512] [--svg]');
  console.log('           [--styled --dark #0a2a8a --light #fff --accent #1a6fbf --logo logo.png --logoRatio 0.14]');
  console.log('  webhook  verify|handle --provider mercadopago|asaas|pagbank --file event.json');
  console.log('           --secret-env VAR [--token-env VAR] --headers "X-Signature:...,X-Request-Id:..."');
  console.log('           handle também exige --charges charges.csv');
  console.log('  reconcile --charges charges.csv --events events.ndjson [--format json|csv] [--out file]');
}

main().catch((error) => {
  print({ ok: false, error: (error as Error).message });
  process.exit(1);
});
