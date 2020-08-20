// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import { E } from '@agoric/eventual-send';
import dappConstants from '../ui.old/public/conf/defaults';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

// The contract's board ID for the assurance issuer.
const {
  INSTANCE_BOARD_ID,
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
export default async function deployWallet(homePromise, { bundleSource, pathResolve }) {

  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the home references.
  const { 

    // *** LOCAL REFERENCES ***

    // This wallet only exists on this machine, and only you have
    // access to it. The wallet stores purses and handles transactions.
    wallet, 

    // *** ON-CHAIN REFERENCES ***

    board,

    uploads: scratch,

    zoe,
  } = home;

  const instance = await E(board).getValue(INSTANCE_BOARD_ID);
  const publicAPI = await E(zoe).getPublicFacet(instance);

  /**
   * @type {import('../contract/src/pegasus').Pegasus}
   */
  const pegasus = publicAPI;

  const notifier = await E(pegasus).getNotifier();
  const { value } = await E(notifier).getUpdateSince();

  // FIXME: Don't just select the last peg.
  /** @type {import('../contract/src/pegasus').Peg} */
  const peg = value[value.length - 1];

  const localBrand = await E(peg).getLocalBrand();
  const localIssuer = await E(pegasus).getLocalIssuer(localBrand);

  let SHADOW_ISSUER = 'ATOMs I think';
  const pursePetname = process.env.PURSE || "Bob's Atoms";

  // Associate the issuer with a petname.
  const already = await E(wallet).getIssuers();
  const pnb = already.find(([petname, issuer]) => petname === SHADOW_ISSUER || issuer === localIssuer);
  if (pnb) {
    SHADOW_ISSUER = pnb[0];
    console.log('Already have', SHADOW_ISSUER);
  } else {
    console.log('Adding issuer', SHADOW_ISSUER);
    await E(wallet).addIssuer(SHADOW_ISSUER, localIssuer);
  }

  // Create an empty purse for that issuer, and give it a petname.
  await E(wallet).makeEmptyPurse(SHADOW_ISSUER, pursePetname);

  // We are done!
  console.log('INSTALLED in local wallet');
  console.log(`Shadow issuer:`, SHADOW_ISSUER);
  console.log(`Shadow purse:`, pursePetname);
}
