// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import dappConstants from '../ui.old/public/conf/defaults';
import { E } from '@agoric/eventual-send';

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

    // The registry lives on-chain, and is used to make private
    // objects public to everyone else on-chain. These objects get
    // assigned a unique string key. Given the key, other people can
    // access the object through the registry.
    registry,

    uploads: scratch,

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
