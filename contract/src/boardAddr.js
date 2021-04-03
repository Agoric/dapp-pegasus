import { assert, q, details as X } from '@agoric/assert';
import { Bech32, fromHex, toHex } from '@cosmjs/encoding';

export const PREFIX = 'agboard';

const { freeze } = Object;

export const BoardId = freeze({
  /** @param { string } boardId of the form board:123... */
  toBech32(boardId) {
    const parts = boardId.match(/^board:([0-9]+)$/);
    assert(parts, X`bad board id: ${q(boardId)}; expected board:123...`);
    const hex = BigInt(parts[1]).toString(16);
    const pad = hex.length % 2 === 1 ? '0' : '';
    return Bech32.encode(PREFIX, fromHex(pad + hex));
  },
  /** @param { string } addr */
  fromBech32(addr) {
    const { data } = Bech32.decode(addr);
    const id = BigInt(`0x${toHex(data)}`);
    return `board:${id}`;
  },
});
