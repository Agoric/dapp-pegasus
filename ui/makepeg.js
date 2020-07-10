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
  GAIA_IBC_ADDRESS,
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
    ibcport: untypedPorts,
  } = home;

  /** @type {import('@agoric/swingset-vat/src/vats/network').Port[]} */
  const ibcport = untypedPorts;

  const instanceHandle = await E(registry).get(INSTANCE_REG_KEY);
  const { publicAPI } = await E(zoe).getInstanceRecord(instanceHandle);

  /**
   * @type {import('../contract/src/pegasus').Pegasus}
   */
  const pegasus = publicAPI;

  const chandler = await E(pegasus).makePegConnectionHandler();
  const conn = await E(ibcport[0]).connect(GAIA_IBC_ADDRESS, chandler);
  const peg = await E(pegasus).pegRemote('Gaia ATOM', conn, 'atom');

  // Save our peg for later work.
  await E(scratch).set('gaiaPeg', peg);

  const localBrand = await E(peg).getLocalBrand();
  const localIssuer = await E(pegasus).getLocalIssuer(localBrand);

  const SHADOW_ISSUER = 'My ATOMs';
  const SHADOW_PURSE = 'Atomz fer realz';

  // Associate the issuer with a petname.
  await E(wallet).addIssuer(SHADOW_ISSUER, localIssuer);

  // Create an empty purse for that issuer, and give it a petname.
  await E(wallet).makeEmptyPurse(SHADOW_ISSUER, SHADOW_PURSE);
  const receiver = await E(wallet).addDepositFacet(SHADOW_PURSE);

  // Actually transfer some atomz to us!
  await E(conn).send(JSON.stringify({ tap: receiver }));

  // We are done!
  console.log('INSTALLED in local wallet');
  console.log(`Shadow issuer:`, SHADOW_ISSUER);
  console.log(`Shadow purse:`, SHADOW_PURSE);
}
