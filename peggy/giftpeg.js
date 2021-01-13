// @ts-check
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import { E } from '@agoric/eventual-send';
import { makeLocalAmountMath } from '@agoric/ertp';

import { DEMO_PEGS } from './demoConfig';

import '@agoric/ertp/exported';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 */
export default async function giftCollateral(homePromise) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the home references.
  const {
    board,
    // *** LOCAL REFERENCES ***
    wallet,
    scratch,
  } = home;

  const walletBridge = E(wallet).getScopedBridge(
    'Treasury',
    'http://localhost:3000',
  );

  console.log('Waiting for dapp approval in wallet');
  const collateralIssuers = await E(scratch).get('treasuryCollateralIssuers');
  await Promise.all(
    DEMO_PEGS.map(async ({ symbol, giftValue }, i) => {
      if ((process.env.GIFT_SYMBOL || symbol) !== symbol) {
        return;
      }
      console.log('Gifting', symbol, giftValue);
      const issuerKit = collateralIssuers[i];
      const issuerMath = await makeLocalAmountMath(issuerKit.issuer);

      const giftAmount = issuerMath.make(giftValue);
      const gift = await E(issuerKit.mint).mintPayment(giftAmount);

      const [brandId, issuerId] = await Promise.all([
        E(board).getId(issuerKit.brand),
        E(board).getId(issuerKit.issuer),
      ]);

      await E(walletBridge).suggestIssuer(symbol, issuerId);

      const depFacetId = await E(walletBridge).getDepositFacetId(brandId);
      const depFacet = E(board).getValue(depFacetId);

      await E(depFacet).receive(gift);
    }),
  );

  console.log('Gifted', collateralIssuers.length, 'treasuryCollateralIssuers');
}
