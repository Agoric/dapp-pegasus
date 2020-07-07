// @ts-check

// eslint-disable-next-line spaced-comment
/// <reference types="ses" />

import { assert, details } from '@agoric/assert';
import produceIssuer from '@agoric/ertp';
import makeStore from '@agoric/store';
import { E } from '@agoric/eventual-send';

/**
 * Default name of the math helpers for creating a remote peg.
 */
const DEFAULT_MATH_HELPERS_NAME = 'nat';

/**
 * Default scope type.
 */
const DEFAULT_SCOPE_TYPE = 'ics20';

/**
 * @typedef {import('@agoric/ertp/src/issuer').Amount} Amount
 * @typedef {import('@agoric/ertp/src/issuer').Brand} Brand
 * @typedef {import('@agoric/ertp/src/issuer').Issuer} Issuer
 * @typedef {import('@agoric/ertp/src/issuer').Payment} Payment
 * @typedef {import('@agoric/zoe').MakeContract} MakeContract
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Connection} Connection
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Endpoint} Endpoint
 */

/**
 * @typedef {'ics20'|'raw'} ScopeType
 * @typedef {string} Denom
 * @typedef {string} DepositAddress
 * @typedef {Object} RemotePeg
 * @property {Issuer} issuer
 * @property {Denom} denom
 * @property {Endpoint} endpoint
 * @property {ScopeType} scopeType
 */

/**
 * Get the denomination combined with the network address.
 *
 * @param {Endpoint|PromiseLike<Endpoint>} endpointP network connection address
 * @param {Denom} denom denomination
 * @param {ScopeType} [scopeType=DEFAULT_SCOPE_TYPE] how to combine the endpoint
 * @returns {Promise<string>} denomination scoped to endpoint
 */
const getScopedDenom = (endpointP, denom, scopeType = DEFAULT_SCOPE_TYPE) =>
  E.when(
    endpointP,
    /** @param {Endpoint} endpoint */ endpoint => {
      switch (scopeType) {
        case 'raw':
          return `${endpoint}/${denom}`;

        case 'ics20': {
          // TODO: Deconstruct IBC endpoints to use ICS-20 conventions.
          return `FIXME/ics20/${denom}`;
        }

        default:
          assert(false, details`Invalid denomination scopeType ${scopeType}`);
      }
    },
  );

/**
 * Create the public facet of the pegging contract.
 */
const makePublicAPI = () => {
  return harden({
    /**
     * Send a pegged payment back to its home issuer.
     *
     * @param {Payment} payment
     * @param {DepositAddress} depositAddress
     * @returns {Promise<void>}
     */
    send(payment, depositAddress) {
      // TODO
      return Promise.resolve();
    },
    /**
     * Send a payment over a pegged network endpoint.
     *
     * @param {Payment} payment
     * @param {DepositAddress} depositAddress
     * @param {Endpoint} viaEndpoint
     * @returns {Promise<void>}
     */
    sendVia(payment, depositAddress, viaEndpoint) {
      // TODO
      return Promise.resolve();
    },
    /**
     * Peg a local asset over a network connection.
     *
     * @param {Connection} c The network connection (IBC channel) to communicate over
     * @param {Issuer} issuer Local ERTP issuer whose assets should be pegged to c
     * @returns {Promise<void>}
     */
    pegLocal(c, issuer) {
      return Promise.resolve();
    },
    /**
     * Peg a remote asset over a network connection.
     *
     * @param {Connection} c The network connection (IBC channel) to communicate over
     * @param {Denom} denom Remote, unprefixed denomination
     * @param {string} [mathHelpersName='nat'] The kind of math helpers for the pegged extents
     * @param {ScopeType} [scopeType=DEFAULT_SCOPE_TYPE] denomination scope type
     * @returns {Promise<void>}
     */
    pegRemote(
      c,
      denom,
      mathHelpersName = DEFAULT_MATH_HELPERS_NAME,
      scopeType = DEFAULT_SCOPE_TYPE,
    ) {
      const epP = /** @type {Promise<Endpoint>} */ (E(c).getLocalAddress());
      return getScopedDenom(epP, denom, scopeType).then(scopedDenom => {
        const issuerResults = produceIssuer(scopedDenom, mathHelpersName);
        // TODO
      });
    },

    /**
     * Look up a remote peg by brand.
     *
     * @param {Brand} brand
     * @returns {RemotePeg?}
     */
    getRemoteByBrand(brand) {
      // TODO
      return undefined;
    },

    /**
     * Look up a remote peg by denomination and endpoint.
     *
     * @param {Denom} denom
     * @param {Endpoint} endpoint
     * @returns {RemotePeg?}
     */
    getRemoteByEndpoint(denom, endpoint) {
      // TODO
      return undefined;
    },
  });
};

/**
 * @type {MakeContract}
 */
const makeContract = zcf => {
  zcf.initPublicAPI(makePublicAPI());
  const adminHook = _offerHandle => {
    return `no administrative capabilities`;
  };
  return zcf.makeInvitation(adminHook, 'admin');
};

harden(makeContract);
export { makeContract };
