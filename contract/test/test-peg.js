// eslint-disable-next-line import/no-extraneous-dependencies
import '@agoric/install-ses';
// eslint-disable-next-line import/no-extraneous-dependencies
import { test } from 'tape-promise/tape';

import { E } from '@agoric/eventual-send';
import harden from '@agoric/harden';
import {
  makeNetworkProtocol,
  makeLoopbackProtocolHandler,
} from '@agoric/swingset-vat/src/vats/network';

// eslint-disable-next-line import/no-extraneous-dependencies
import bundleSource from '@agoric/bundle-source';

import { makeZoe } from '@agoric/zoe';

const contractPath = `${__dirname}/../src/pegasus`;

/**
 * @param {import('tape-promise/tape').Test} t
 */
async function testRemotePeg(t) {
  t.plan(8);

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

  const zoe = makeZoe();

  // Pack the contract.
  const contractBundle = await bundleSource(contractPath);
  const installationHandle = await E(zoe).install(contractBundle);

  const {
    instanceRecord: { publicAPI },
  } = await E(zoe).makeInstance(installationHandle, {}, { board });

  /**
   * @type {import('../src/pegasus').Pegasus}
   */
  const pegasus = publicAPI;
  const network = makeNetworkProtocol(makeLoopbackProtocolHandler(E));

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

  const pegP = await E(pegasus).pegRemote('Gaia', connP, 'uatom');
  const localBrand = await E(pegP).getLocalBrand();
  const localIssuer = await E(pegasus).getLocalIssuer(localBrand);

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

  // FIXME: This should be able to be a promise for payment, but Zoe balks:
  // [TypeError: deposit does not accept promises as first argument. Instead of passing the promise (deposit(paymentPromise)), consider unwrapping the promise first: paymentPromise.then(actualPayment => deposit(actualPayment))]
  const localAtomsP = await E(localPurseP).withdraw(localAtomsAmount);

  const allegedName = await E(pegP).getAllegedName();
  t.equals(allegedName, 'Gaia', 'alleged peg name is equal');
  const transferInvite = await E(pegasus).makeInviteToTransfer(
    pegP,
    'markaccount',
  );
  const { outcome, payout } = await E(zoe).offer(
    transferInvite,
    harden({
      give: { Transfer: localAtomsAmount },
    }),
    harden({ Transfer: localAtomsP }),
  );
  t.equals(await outcome, undefined, 'transfer is successful');

  const paymentPs = await payout;
  const refundAmount = await E(localIssuer).getAmountOf(paymentPs.Transfer);
  const isEmptyRefund = await E(E(localIssuer).getAmountMath()).isEmpty(
    refundAmount,
  );
  t.assert(isEmptyRefund, 'no refund from success');

  const stillIsLive = await E(localIssuer).isLive(localAtomsP);
  t.assert(!stillIsLive, 'payment is consumed');
}

test('remote peg', t =>
  testRemotePeg(t).catch(err => t.isNot(err, err, 'unexpected exception')));
