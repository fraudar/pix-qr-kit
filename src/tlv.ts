export type TlvNode = { id: string; value: string };

export class PixTlvError extends Error {
  constructor(message: string, public readonly offset?: number) {
    super(message);
    this.name = 'PixTlvError';
  }
}

export function encodeTlv(id: string, value: string): string {
  if (!/^\d{2}$/.test(id)) throw new PixTlvError(`ID must be 2 digits: ${id}`);
  if (value.length > 99) {
    throw new PixTlvError(`TLV ${id} value exceeds 99 characters (${value.length})`);
  }
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

export function decodeTlv(payload: string): TlvNode[] {
  const nodes: TlvNode[] = [];
  let offset = 0;

  while (offset < payload.length) {
    const id = payload.slice(offset, offset + 2);
    const size = payload.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(size)) {
      throw new PixTlvError('Malformed TLV header', offset);
    }

    const length = Number(size);
    const value = payload.slice(offset + 4, offset + 4 + length);
    if (value.length !== length) {
      throw new PixTlvError(`TLV ${id} declares ${length} chars, found ${value.length}`, offset);
    }

    nodes.push({ id, value });
    offset += 4 + length;
  }

  return nodes;
}

export function findNode(nodes: TlvNode[], id: string): string | undefined {
  return nodes.find((node) => node.id === id)?.value;
}
