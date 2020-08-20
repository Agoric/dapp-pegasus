// @ts-check
// Agoric Dapp api deployment script

import fs from 'fs';
import installationConstants from '../ui.old/public/conf/installationConstants.js';
import { E } from '@agoric/eventual-send';

import '@agoric/zoe/exported';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

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
export default async function deployApi(homePromise, { bundleSource, pathResolve }) {

  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const { 

    // *** LOCAL REFERENCES ***

    // Scratch is a map only on this machine, and can be used for
    // communication in objects between processes/scripts on this
    // machine.
    uploads: scratch,  

    // The spawner persistently runs scripts within ag-solo, off-chain.
    spawner,

    // *** ON-CHAIN REFERENCES ***
    zoe: untypedZoe,

    board,
    ibcport: untypedPorts,
  } = home;

  /** @type {import('@agoric/swingset-vat/src/vats/network').Port[]} */
  const ibcport = untypedPorts;

  /** @type {ZoeService} */
  const zoe = untypedZoe;

  // To get the backend of our dapp up and running, first we need to
  // grab the installationHandle that our contract deploy script put
  // in the public registry.
  const { 
    INSTALLATION_BOARD_ID,
    CONTRACT_NAME,
  } = installationConstants;
  const pegasusContractInstallationHandle = await E(board).getValue(INSTALLATION_BOARD_ID);
  
  const {
    instance,
  } = await E(zoe)
    .startInstance(pegasusContractInstallationHandle, {}, { board });
  console.log('- SUCCESS! contract instance is running on Zoe');

  // An Instance is an opaque identifier like an installationHandle.
  // Instance identifies an instance of a running contract.
  if (!instance) {
    console.log('- FAILURE! contract instance NOT retrieved.');
    throw new Error('Unable to create contract instance');
  }

  // Now that we've done all the admin work, let's share this
  // Instance by adding it to the registry. Any users of our
  // contract will use this Instance to get invitations to the
  // contract in order to make an offer.
  const INSTANCE_BOARD_ID = await E(board).getId(instance);
  await E(scratch).set('pegasus', INSTANCE_BOARD_ID);

  console.log(`-- Contract Name: ${CONTRACT_NAME}`);
  console.log(`-- Instance Registry Key: ${INSTANCE_BOARD_ID}`);
  console.log(`-- Peg Registry Key`)

  // We want the Gaia connection to run persistently. (Scripts such as this
  // deploy.js script are ephemeral and all connections to objects
  // within this script are severed when the script is done running.)
  // To run the handler persistently, we must use the spawner to run
  // the code on this machine even when the script is done running.

  // Bundle up the handler code
  const bundle = await bundleSource(pathResolve('./src/gaiaTransfer.js'));
  
  // Install it on the spawner
  const gaiaInstall = E(spawner).install(bundle);

  // Spawn the sim gaia transfer handler.
  await E(gaiaInstall).spawn({ port: ibcport[1] });
  const GAIA_IBC_ADDRESS = await E(ibcport[1]).getLocalAddress();

  // Re-save the constants somewhere where the UI and api can find it.
  const dappConstants = {
    INSTANCE_BOARD_ID,
    GAIA_IBC_ADDRESS,
    BRIDGE_URL: 'http://127.0.0.1:8000',
    API_URL: 'http://127.0.0.1:8000',
  };
  const defaultsFile = pathResolve(`../ui.old/public/conf/defaults.js`);
  console.log('writing', defaultsFile);
  const defaultsContents = `\
// GENERATED FROM ${__filename}
export default ${JSON.stringify(dappConstants, undefined, 2)};
`;
  await fs.promises.writeFile(defaultsFile, defaultsContents);
}
