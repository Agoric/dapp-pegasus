// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import dappConstants from '../ui.old/public/conf/defaults';
import { E } from '@agoric/eventual-send';

import '@agoric/zoe/exported';
import '@agoric/swingset-vat/src/vats/network/types';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

// The contract's board id for the assurance issuer.
const {
  INSTANCE_BOARD_ID,
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

    board,

    zoe: untypedZoe,
    ibcport: untypedPorts,
  } = home;

  /** @type {ZoeService} */
  const zoe = untypedZoe;

  /** @type {Port[]} */
  const ibcport = untypedPorts;

  /** @type {Instance} */
  const instance = await E(board).getValue(INSTANCE_BOARD_ID);
  const publicAPI = await E(zoe).getPublicFacet(instance);

  /**
   * @type {import('../contract/src/pegasus').Pegasus}
   */
  const pegasus = publicAPI;

  const chandler = await E(pegasus).makePegConnectionHandler();
  const conn = await E(ibcport[0]).connect(GAIA_IBC_ADDRESS, chandler);
  const peg = await E(pegasus).pegRemote('Gaia ATOM', conn, 'atom');

  const localBrand = await E(peg).getLocalBrand();
  const localIssuer = await E(pegasus).getLocalIssuer(localBrand);


  console.log('Waiting for Pegasus Dapp Approval in your wallet...');
  const DAPP_ORIGIN = 'https://peg-as.us';
  await E(wallet).waitForDappApproval('Pegasus', DAPP_ORIGIN);

  console.log('Continuing...');
  await E(wallet).suggestInstance('Pegasus', INSTANCE_BOARD_ID, DAPP_ORIGIN);

  const ATOM_ISSUER = 'My ATOM';
  const SHADOW_PURSE = `Alice's Atoms`;

  // Associate the issuer with a petname.
  const ISSUER_BOARD_ID = await E(board).getId(localIssuer);
  await E(wallet).suggestIssuer(ATOM_ISSUER, ISSUER_BOARD_ID, DAPP_ORIGIN);

  const receiver = await E(wallet).getDepositFacetId();

  // Actually transfer some atomz to us!
  await E(conn).send(JSON.stringify({ tap: receiver, amount: '100' }));

  // We are done!
  console.log('INSTALLED in local wallet');
}
