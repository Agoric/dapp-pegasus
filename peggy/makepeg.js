// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import { E } from '@agoric/eventual-send';
// import { spawn } from 'child_process';

import '@agoric/zoe/exported';
import '@agoric/swingset-vat/src/vats/network/types';
import { makePromiseKit } from '@agoric/promise-kit';

import { DEMO_PEGS } from './demoConfig';
import dappConstants from '../ui.old/public/conf/defaults';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

// The contract's board id for the assurance issuer.
const { INSTANCE_BOARD_ID } = dappConstants;

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 */
export default async function getCollateralIssuers(
  homePromise,
  { bundleSource, pathResolve },
) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the home references.
  const {
    // *** LOCAL REFERENCES ***

    scratch,
    spawner,

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
  const publicFacet = await E(zoe).getPublicFacet(instance);

  /**
   * @type {import('../contract/src/pegasus').Pegasus}
   */
  const pegasus = publicFacet;

  const bundle = await bundleSource(pathResolve('./src/listener.js'));
  const listenerInstall = E(spawner).install(bundle);

  const chandler = await E(pegasus).makePegConnectionHandler();

  const localAddr = await E(ibcport[0]).getLocalAddress();
  console.log('Waiting for inbound IBC connection on', localAddr);
  const conn = await E(listenerInstall).spawn({ chandler, port: ibcport[0] });

  const collateralIssuers = await Promise.all(
    DEMO_PEGS.map(
      async ({
        symbol,
        denom,
        giftValue,
        _collateralValue,
        decimalPlaces,
        scaleToLocalPlaces,
      }) => {
        console.log('Creating', symbol, denom);
        const peg = await E(pegasus).pegRemote(symbol, conn, denom, {
          decimalPlaces,
          scaleToLocalPlaces,
        });

        const localBrand = await E(peg).getLocalBrand();
        const localIssuer = await E(pegasus).getLocalIssuer(localBrand);

        return {
          symbol,
          issuer: localIssuer,
          brand: localBrand,
        };
      },
    ),
  );

  if (collateralIssuers.length) {
    await E(scratch).set('treasuryCollateralIssuers', collateralIssuers);
  }
  console.log('Have', collateralIssuers.length, 'treasuryCollateralIssuers');
  console.log('Next deploy callpeg.js');
}
