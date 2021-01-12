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
  } = home;

  const bundle = await bundleSource(pathResolve('./src/makemint.js'));
  const makeMintInstall = E(spawner).install(bundle);

  /** @type {{ makeIssuerKit: MakeIssuerKit }} */
  const makeMint = await E(makeMintInstall).spawn();

  console.log('Waiting for dapp approval in wallet');
  const collateralIssuers = await Promise.all(
    DEMO_PEGS.map(async ({ symbol, denom, collateralValue, decimalPlaces }) => {
      console.log('Creating', symbol, denom);
      const issuerKit = await E(makeMint).makeIssuerKit(symbol, 'nat', {
        decimalPlaces,
      });
      const issuerMath = await makeLocalAmountMath(issuerKit.issuer);

      const amount = issuerMath.make(collateralValue);
      const payment = await E(issuerKit.mint).mintPayment(amount);

      return {
        symbol,
        ...issuerKit,
        amount,
        payment,
      };
    }),
  );

  console.log('Have', collateralIssuers.length, 'treasuryCollateralIssuers');
  if (collateralIssuers.length) {
    await E(scratch).set('treasuryCollateralIssuers', collateralIssuers);
  }
  console.log('Done!');
}
