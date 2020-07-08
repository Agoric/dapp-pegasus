import '@agoric/install-ses';
// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from 'tape-promise/tape';

import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';
import {
  makeNetworkProtocol,
  makeLoopbackProtocolHandler,
} from '@agoric/swingset-vat/src/vats/network';

import makePegasus from '../src/make-peg';

/**
 * @param {import('tape-promise/tape').Test} t
 */
async function testRemoteSendLocal(t) {
  t.plan(6);
  /**
   * @type {import('@agoric/ertp').DepositFacet?}
   */
  let localDepositFacet;
  const board = harden({
    getValue(id) {
      t.equals(id, '0x1234', 'got the deposit-only facet');
      return localDepositFacet;
    },
  });

  const network = makeNetworkProtocol(makeLoopbackProtocolHandler(E));
  const pegasus = makePegasus(board);

  const portP = E(network).bind('/ibc-channel/chanabc/ibc-port/portdef');
  const portName = await E(portP).getLocalAddress();

  /**
   * Pretend we're Gaia.
   * @type {import('@agoric/swingset-vat/src/vats/network').Connection?}
   */
  let gaiaConnection;
  E(portP).addListener({
    async onAccept(_p, _localAddr, _remoteAddr) {
      return harden({
        async onOpen(c) {
          gaiaConnection = c;
        },
        async onReceive(_c, packetBytes) {
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
  const chandler = E(pegasus).makePegConnectionHandler();
  const connP = E(portP).connect(portName, chandler);

  const [courier, pegDesc] = await E(pegasus).pegRemote(connP, 'uatom');
  const { issuer: localIssuer, brand: localBrand } = pegDesc;

  const localPurseP = E(localIssuer).makeEmptyPurse();
  localDepositFacet = await E(localPurseP).makeDepositFacet();

  // Get some local Atoms.
  const sendPacket = {
    amount: '100',
    denomination: 'portdef/chanabc/uatom',
    receiver: '0x1234',
    sender: 'FIXME:sender',
  };

  const sendAckData = await E(gaiaConnection).send(JSON.stringify(sendPacket));
  const sendAck = JSON.parse(sendAckData);
  t.deepEquals(sendAck, { success: true }, 'Gaia sent the atoms');
  if (!sendAck.success) {
    console.log(sendAckData, sendAck.error);
  }

  const localAtomsAmount = await E(localPurseP).getCurrentAmount();
  t.deepEquals(
    localAtomsAmount,
    { brand: localBrand, extent: 100 },
    'we received the shadow atoms',
  );

  const localAtomsP = E(localPurseP).withdraw(localAtomsAmount);

  const transferResult = await E(courier).transfer(localAtomsP, 'markaccount');
  t.deepEquals(transferResult, { success: true }, 'transfer is successful');

  const stillIsLive = await E(localIssuer).isLive(localAtomsP);
  t.assert(!stillIsLive, 'payment is consumed');
}

test('remote peg - send local erights over network', t =>
  testRemoteSendLocal(t).catch(err =>
    t.isNot(err, err, 'unexpected exception'),
  ));
