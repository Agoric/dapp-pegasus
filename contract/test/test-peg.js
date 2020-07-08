import '@agoric/install-ses';
// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from 'tape-promise/tape';

import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';
import {
  makeNetworkProtocol,
  makeLoopbackProtocolHandler,
} from '@agoric/swingset-vat/src/vats/network';

import makePeg from '../src/make-peg';

/**
 * @param {import('tape-promise/tape').Test} t
 */
async function testRemoteSendLocal(t) {
  t.plan(3);
  const network = makeNetworkProtocol(makeLoopbackProtocolHandler(E));
  const pegasus = makePeg();

  const portP = E(network).bind('/ibc-channel/chanabc/ibc-port/portdef');
  const portName = await E(portP).getLocalAddress();

  // Pretend we're Gaia.
  E(portP).addListener({
    async onAccept(_p, _localAddr, _remoteAddr) {
      return harden({
        onReceive(_c, packetBytes) {
          const packet = JSON.parse(packetBytes);
          t.deepEquals(
            packet,
            {
              amount: '100',
              denomination: 'portdef/chanabc/uatom',
              receiver: 'markaccount',
              sender: 'FIXME:sender',
            },
            'expected transfer packet',
          );
          return JSON.stringify({ success: true });
        },
      });
    },
  });

  // Pretend we're Agoric.
  const connP = E(portP).connect(portName, {
    async onReceive(_c, packetBytes) {
      console.log('Agoric got', packetBytes);
    },
  });
  console.log(await E(connP).getRemoteAddress());

  const [courier, pegDesc] = await E(pegasus).pegRemote(connP, 'uatom');
  const { issuer: localIssuer, mint: localMint } = pegDesc;

  const amountMathP = E(localIssuer).getAmountMath();

  // Mint some local erights.
  const atoms100 = await E(amountMathP).make(100);
  const localAtoms = E(localMint).mintPayment(atoms100);

  const transferResult = await E(courier).transfer(localAtoms, 'markaccount');
  t.deepEquals(transferResult, { success: true }, 'transfer is successful');

  const stillIsLive = await E(localIssuer).isLive(localAtoms);
  t.assert(!stillIsLive, 'payment is consumed');
}

test('remote peg - send local erights over network', t =>
  testRemoteSendLocal(t).catch(err =>
    t.isNot(err, err, 'unexpected exception'),
  ));
