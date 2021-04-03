// @ts-check
// eslint-disable-next-line import/no-extraneous-dependencies
import 'ses';
import test from 'ava';
import { BoardId } from '../src/boardAddr';

const cases = [
  { id: 'board:1234', addr: 'agboard1qnfq6ux7qx' },
  { id: 'board:123456789', addr: 'agboard1qadu69gewu27t' },
];

test('embed boardid in bech32', t => {
  for (const { id, addr } of cases) {
    t.is(BoardId.toBech32(id), addr);
    t.is(BoardId.fromBech32(addr), id);
  }
});
