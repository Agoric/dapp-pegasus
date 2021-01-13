// @ts-check
/* eslint-disable no-await-in-loop, no-continue */
/* global BigInt */
// Agoric Dapp UI deployment script

// NOTE: In the future, this will take place via the wallet UI.
// Until that time, this allows contract developers to add their
// issuer and purse to an individual wallet.

import { E } from '@agoric/eventual-send';
import { spawn } from 'child_process';

import { makePromiseKit } from '@agoric/promise-kit';

import { DEMO_PEGS } from './demoConfig';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

const run = args => {
  const doneP = makePromiseKit();
  console.log('Running:', ...args);
  const cp = spawn(args[0], args.slice(1), { stdio: 'inherit' });
  cp.on('exit', code => {
    console.log('exited with code', code);
    doneP.resolve(code);
  });
  return doneP.promise;
};

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 */
export default async function getCollateralIssuers(homePromise) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the home references.
  const {
    // *** LOCAL REFERENCES ***

    scratch,

    // *** ON-CHAIN REFERENCES ***

    board,
  } = home;

  const oldCollateralIssuers = await E(scratch).get(
    'treasuryCollateralIssuers',
  );

  let paid = 0;
  const collateralIssuers = [...oldCollateralIssuers];
  for (let i = 0; i < collateralIssuers.length; i += 1) {
    const ci = collateralIssuers[i];
    if (ci < 2 && ci.payment) {
      continue;
    }
    const { symbol, issuer } = ci;
    const {
      denom,
      _giftValue,
      collateralValue,
      decimalPlaces = 0,
      scaleToLocalPlaces = 0,
    } = DEMO_PEGS.find(peg => peg.symbol === symbol);

    const transferValue =
      BigInt(collateralValue) *
      BigInt(10) ** BigInt(-scaleToLocalPlaces - decimalPlaces);

    const paymentP = makePromiseKit();
    const depositFacet = harden({
      async receive(payment) {
        const amount = await E(issuer).getAmountOf(payment);
        paymentP.resolve({ payment, amount });
      },
    });

    // Prompt the peggy chain to deposit to us.
    const depositId = await E(board).getId(depositFacet);

    const finalHurrah = [
      'rly',
      'tx',
      'raw',
      'transfer',
      'peggy-test',
      'agoric',
      `${transferValue}${denom}`,
      `raw:board:${depositId}`,
    ];
    if (await run(finalHurrah)) {
      await run([
        'client',
        'eth-to-cosmos',
        '--ethereum-key=0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7',
        '--ethereum-rpc=http://localhost:8545',
        '--contract-address=0xD7600ae27C99988A6CD360234062b540F88ECA43',
        `--erc20-address=${denom.substr('peggy'.length)}`,
        `--amount=${transferValue}`,
        `--cosmos-destination=cosmos1nqypqptka5w9eph6kdvguvujnxhmn3l8u9guuc`,
      ]);

      while (await run(finalHurrah)) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const { amount, payment } = await paymentP.promise;
    console.log(depositId, 'received', amount.value, symbol);

    // Mutate.
    collateralIssuers[i] = {
      ...ci,
      amount,
      payment,
    };

    // Now copy.
    await E(scratch).set('treasuryCollateralIssuers', [...collateralIssuers]);
    paid += 1;
  }

  console.log(
    `Added payments for ${paid}/${collateralIssuers.length} treasuryCollateralIssuers`,
  );
}
