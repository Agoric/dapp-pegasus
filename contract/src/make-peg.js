// @ts-check

// eslint-disable-next-line spaced-comment
/// <reference types="ses" />

import { assert, details } from '@agoric/assert';
import produceIssuer from '@agoric/ertp';
import makeStore from '@agoric/store';
import { E } from '@agoric/eventual-send';
import { parse as parseMultiaddr } from '@agoric/swingset-vat/src/vats/network/multiaddr';

const DEFAULT_AMOUNT_MATH_KIND = 'nat';
const DEFAULT_PROTOCOL = 'ics20-1';

/**
 * @typedef {import('@agoric/ertp/src/issuer').Amount} Amount
 * @typedef {import('@agoric/ertp/src/issuer').Brand} Brand
 * @typedef {import('@agoric/ertp/src/issuer').Issuer} Issuer
 * @typedef {import('@agoric/ertp/src/issuer').Payment} Payment
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Connection} Connection
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Endpoint} Endpoint
 */

/**
 * @typedef {string} DenomUri
 * @typedef {string} Denom
 * @typedef {string} DepositAddress
 * @typedef {string} TransferProtocol
 *
 * @typedef {Object} PegDescriptor
 * @property {Issuer} issuer
 * @property {DenomUri} denomUri
 * @property {Endpoint} endpoint
 */

/**
 * @typedef {Object} Courier
 * @property {(payment: Payment, depositAddress: DepositAddress) => Promise<void>} transfer
 */

/**
 * Get the denomination combined with the network address.
 *
 * @param {Endpoint | PromiseLike<Endpoint>} endpointP network connection address
 * @param {Denom} denom denomination
 * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] the protocol to use
 * @returns {Promise<string>} denomination URI scoped to endpoint
 */
const getDenomUri = async (endpointP, denom, protocol = DEFAULT_PROTOCOL) =>
  E.when(endpointP, endpoint => {
    switch (protocol) {
      case 'ics20-1': {
        return E.when(endpointP, endpoint => {
          // TODO: Deconstruct IBC endpoints to use ICS-20 conventions.
          // IBC endpoint: `/ibc-hop/gaia/ibc-port/transfer/ordered/ics20-1/ibc-channel/chtedite`
          const pairs = parseMultiaddr(endpoint);

          const protoPort = pairs.find(([proto]) => proto === 'ibc-port');
          assert(protoPort, details`Cannot find IBC port in ${endpoint}`);

          const protoChannel = pairs.find(([proto]) => proto === 'ibc-channel');
          assert(protoChannel, details`Cannot find IBC channel in ${endpoint}`);

          const port = protoPort[1];
          const channel = protoChannel[1];
          return `${protocol}:${port}/${channel}/${denom}`;
        });
      }

      default:
        assert.fail(details`Invalid denomination scopeType ${scopeType}`);
    }
  });

/**
 * Create the public facet of the pegging contract.
 */
const makePeg = () => {
  return harden({
    getDenomUri,
    /**
     * Peg a remote asset over a network connection.
     *
     * @param {Connection} c The network connection (IBC channel) to communicate over
     * @param {Denom} denom Remote denomination
     * @param {string} [amountMathKind=DEFAULT_AMOUNT_MATH_KIND] The kind of amount math for the pegged extents
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL]
     * @returns {Promise<[Courier,PegDescriptor]>}
     */
    async pegRemote(
      c,
      denom,
      amountMathKind = DEFAULT_AMOUNT_MATH_KIND,
      protocol = DEFAULT_PROTOCOL,
    ) {
      /** @type {Courier} */
      const courier = harden({
        transfer(payment, depositAddress) {
          // TODO
          return Promise.resolve();
        },
      });
      /** @type {PegDescriptor} */
      const pegDescriptor = harden({
        // TODO
        denomUri,
        endpoint,
        issuer,
      });
      return Promise.resolve([courier, pegDescriptor]);
    },

    /**
     * Peg a local asset over a network connection.
     *
     * @param {Promise<Connection>|Connection} c The network connection (IBC channel) to communicate over
     * @param {Issuer} issuer Local ERTP issuer whose assets should be pegged to c
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] Protocol to speak on the connection
     * @returns {Promise<[Courier,PegDescriptor]>}
     */
    pegLocal(c, issuer, protocol = DEFAULT_PROTOCOL) {
      /** @type {Courier} */
      const courier = harden({
        transfer(payment, depositAddress) {
          // TODO
          return Promise.resolve();
        },
      });
      /** @type {PegDescriptor} */
      const pegDescriptor = harden({
        // TODO
        denomUri,
        endpoint,
        issuer,
      });
      return Promise.resolve([courier, pegDescriptor]);
    },

    /**
     * Look up a peg by brand.
     *
     * @param {Brand} brand
     * @returns {PegDescriptor?}
     */
    getPegByBrand(brand) {
      // TODO
      return undefined;
    },

    /**
     * Look up pegs by endpoint.
     *
     * @param {Endpoint} endpoint
     * @returns {PegDescriptor[]}
     */
    getPegByEndpoint(endpoint) {
      // TODO
      return harden([]);
    },
  });
};

export default makePeg;
