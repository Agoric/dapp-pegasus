import { makeIssuerKit } from '@agoric/ertp';

async function makeMint() {
  return {
    makeIssuerKit(...args) {
      return makeIssuerKit(...args);
    },
  };
}

harden(makeMint);
export default makeMint;
