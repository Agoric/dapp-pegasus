// @ts-check

// eslint-disable-next-line spaced-comment
/// <reference types="ses" />

import makePeg from './make-peg';

/**
 * @type {import('@agoric/zoe').MakeContract}
 */
const makeContract = zcf => {
  zcf.initPublicAPI(makePeg());
  const adminHook = _offerHandle => {
    return `no administrative capabilities`;
  };
  return zcf.makeInvitation(adminHook, 'admin');
};

harden(makeContract);
export { makeContract };
