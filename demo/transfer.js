// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import { E } from '@agoric/eventual-send';
import { assert, details } from '@agoric/assert';
import dappConstants from '../conf/defaults';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

// The contract's registry key for the assurance issuer.
const { INSTANCE_BOARD_ID } = dappConstants;

/**
 * @typedef {Object} DeployPowers The special powers that `agoric deploy` gives us
 * @property {(path: string) => { moduleFormat: string, source: string }} bundleSource
 * @property {(path: string) => string} pathResolve
 */

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 * @param {DeployPowers} powers
 */
export default async function deployTransfer(
  homePromise,
  { bundleSource, pathResolve },
) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the home references.
  const {
    // *** LOCAL REFERENCES ***

    // This wallet only exists on this machine, and only you have
    // access to it. The wallet stores purses and handles transactions.
    wallet,

    spawner,

    // *** ON-CHAIN REFERENCES ***

    board,

    zoe,
  } = home;

  const instance = await E(board).getValue(INSTANCE_BOARD_ID);

  /**
   * @type {import('../contract/src/pegasus').Pegasus}
   */
  const pegasus = await E(zoe).getPublicFacet(instance);

  const notifier = await E(pegasus).getNotifier();
  const { value } = await E(notifier).getUpdateSince();

  // FIXME: Don't just select the last peg.
  /** @type {import('../contract/src/pegasus').Peg} */
  const peg = value[value.length - 1];

  const extent = BigInt(process.env.VALUE || '0');
  let pursePetname = process.env.PURSE || "Bob's Atoms";
  try {
    pursePetname = JSON.parse(pursePetname);
  } catch (e) {
    // nothing
  }
  const { RECEIVER } = process.env;

  assert(RECEIVER, details`$RECEIVER must be set`);

  const invitation = await E(pegasus).makeInvitationToTransfer(peg, RECEIVER);
  const invitationAmount = await E(E(zoe).getInvitationIssuer()).getAmountOf(
    invitation,
  );
  const {
    value: [{ handle: invitationHandle }],
  } = invitationAmount;

  const installation = await E(zoe).getInstallation(invitation);
  const INSTALLATION_BOARD_ID = await E(board).getId(installation);
  const INVITE_BOARD_ID = await E(board).getId(invitationHandle);

  await E(wallet).addPayment(invitation);

  // Spawn the offer in the solo.
  const offer = {
    id: Date.now(),
    invitationHandleBoardId: INVITE_BOARD_ID,
    instanceHandleBoardId: INSTANCE_BOARD_ID,
    installationHandleBoardId: INSTALLATION_BOARD_ID,
    proposalTemplate: {
      give: {
        Transfer: {
          pursePetname,
          value: extent,
        },
      },
    },
  };

  await E(wallet).addOffer(offer, {
    date: Date.now(),
    origin: 'https://peg-as.us',
  });

  // We are done!
  console.log('Proposed transfer; check your wallet!');
}
