// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import dappConstants from '../ui.old/public/conf/defaults';
import { E } from '@agoric/eventual-send';
import { assert, details, q } from '@agoric/assert';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

// The contract's registry key for the assurance issuer.
const {
  INSTANCE_REG_KEY,
} = dappConstants;

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
export default async function deployTransfer(homePromise, { bundleSource, pathResolve }) {

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

    // The registry lives on-chain, and is used to make private
    // objects public to everyone else on-chain. These objects get
    // assigned a unique string key. Given the key, other people can
    // access the object through the registry.
    registry,

    zoe,
  } = home;

  const instanceHandle = await E(registry).get(INSTANCE_REG_KEY);
  const { publicAPI } = await E(zoe).getInstanceRecord(instanceHandle);

  /**
   * @type {import('../contract/src/pegasus').Pegasus}
   */
  const pegasus = publicAPI;

  const notifier = await E(pegasus).getNotifier();
  const { value } = await E(notifier).getUpdateSince();

  // FIXME: Don't just select the first peg.
  /** @type {import('../contract/src/pegasus').Peg} */
  const peg = value[0];

  const extent = JSON.parse(process.env.EXTENT || '0')
  const pursePetname = process.env.PURSE || "Bob's Atoms";
  const RECEIVER = process.env.RECEIVER

  assert(RECEIVER, details`$RECEIVER must be set`);

  // Obtain the correct transfer parameters.
  // Bundle up the hooks code
  const bundle = await bundleSource(pathResolve('./src/transferOffer.js'));
  
  // Install it on the spawner
  const transferInstall = E(spawner).install(bundle);

  // Spawn the offer in the solo.
  const offer = {
    id: Date.now(),
    instanceRegKey: INSTANCE_REG_KEY,
    proposalTemplate: {
      give: {
        Transfer: {
          pursePetname,
          extent,
        },
      },
    },
  };

  await E(transferInstall).spawn({
    inviteMethod: 'makeInviteToTransfer',
    inviteArgs: [peg, RECEIVER],
    offer,
    meta: { date: Date.now(), origin: '*pegasus transfer script*', },
    wallet,
  });

  // We are done!
  console.log('Proposed transfer; check your wallet!');
}
