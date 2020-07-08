// @ts-check

// eslint-disable-next-line spaced-comment
/// <reference types="ses"/>

import { assert, details, q } from '@agoric/assert';
import produceIssuer from '@agoric/ertp';
// import makeStore from '@agoric/store';
import { E } from '@agoric/eventual-send';
import Nat from '@agoric/nat';
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
 * @typedef {Object} FungibleTransferPacket
 * @property {string} amount The extent of the amount
 * @property {Denom} denomination The denomination of the amount
 * @property {string} sender The sender address
 * @property {DepositAddress} receiver The receiver deposit address
 */

/**
 * @typedef {Object} TransferResult
 * @property {boolean} success True if the transfer was successful
 * @property {any} [error] The description of the error
 * @property {Payment} [refund] The refund if the transfer is known to have failed
 */

/**
 * @typedef {Object} Courier
 * @property {(payment: Payment, depositAddress: DepositAddress) => Promise<TransferResult>} transfer
 */

/**
 * Get the denomination combined with the network address.
 *
 * @param {Endpoint|PromiseLike<Endpoint>} endpointP network connection address
 * @param {Denom} denom denomination
 * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] the protocol to use
 * @returns {Promise<string>} denomination URI scoped to endpoint
 */
async function getDenomUri(endpointP, denom, protocol = DEFAULT_PROTOCOL) {
  switch (protocol) {
    case 'ics20-1': {
      return E.when(endpointP, endpoint => {
        // Deconstruct IBC endpoints to use ICS-20 conventions.
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
      throw assert.fail(details`Invalid denomination protocol ${protocol}`);
  }
}

/**
 * Create the public facet of the pegging contract.
 */
const makePeg = () => {
  return harden({
    getDenomUri,
    /**
     * Peg a remote asset over a network connection.
     *
     * @param {Connection|PromiseLike<Connection>} c The network connection (IBC channel) to communicate over
     * @param {Denom} remoteDenom Remote denomination
     * @param {string} [amountMathKind=DEFAULT_AMOUNT_MATH_KIND] The kind of amount math for the pegged extents
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL]
     * @returns {Promise<[Courier,PegDescriptor]>}
     */
    async pegRemote(
      c,
      remoteDenom,
      amountMathKind = DEFAULT_AMOUNT_MATH_KIND,
      protocol = DEFAULT_PROTOCOL,
    ) {
      assert(
        // TODO: Find the exact restrictions on Cosmos denoms.
        remoteDenom.match(/^[a-z][a-z0-9]*$/),
        details`Invalid ics20-1 remoteDenom ${q(
          remoteDenom,
        )}; need Cosmos denomination format`,
      );
      assert(
        amountMathKind === 'nat',
        details`Unimplemented amountMathKind ${q(amountMathKind)}; need "nat"`,
      );
      assert(
        protocol === 'ics20-1',
        details`Unimplemented protocol ${q(protocol)}; need "ics20-1"`,
      );

      // Find our data elements.
      const endpoint = await E(c).getLocalAddress();
      const denomUri = await getDenomUri(endpoint, remoteDenom, protocol);

      const uriMatch = denomUri.match(/^ics20-1:(.*)$/);
      assert(
        uriMatch,
        details`${denomUri} does not begin with ${q('ics20-1:')}`,
      );
      const prefixedDenom = uriMatch[1];

      // Get the issuer for the local erights corresponding to the remote values.
      const {
        issuer: localIssuer,
        mint: localMint,
        brand: localBrand,
      } = produceIssuer(denomUri, amountMathKind);

      /**
       * Convert an inbound packet to a local amount.
       *
       * @param {FungibleTransferPacket} packet
       * @returns {Amount}
       */
      function packetToLocalAmount(packet) {
        // packet.amount is a string in JSON.
        const floatExtent = Number(packet.amount);

        // If we overflow, or don't have a number, throw an exception!
        const extent = Nat(floatExtent);

        return harden({
          brand: localBrand,
          extent,
        });
      }

      /**
       * Convert the amount to a packet to send.
       *
       * @param {Amount} amount
       * @param {DepositAddress} depositAddress
       * @param {'FIXME:sender'} sender
       * @returns {FungibleTransferPacket}
       */
      function localAmountToPacket(amount, depositAddress, sender) {
        const { brand, extent } = amount;
        assert(
          brand === localBrand,
          details`Brand must our local issuer's, not ${q(brand)}`,
        );
        const stringExtent = String(Nat(extent));

        // Generate the ics20-1 packet.
        return harden({
          amount: stringExtent,
          denomination: prefixedDenom,
          receiver: depositAddress,
          sender,
        });
      }

      /**
       * The Courier transfers a payment over the network.
       *
       * @type {Courier}
       */
      const courier = harden({
        async transfer(payment, depositAddress) {
          // Burn the payment, and create a packet to send.
          const amount = await localIssuer.burn(payment);
          const packet = localAmountToPacket(
            amount,
            depositAddress,
            'FIXME:sender',
          );
          const packetBytes = JSON.stringify(packet);
          return E(c)
            .send(packetBytes)
            .then(ack => {
              // We got a response, so possible success.
              const { success, error } = JSON.parse(ack);
              if (!success) {
                // Let the next catch handle this error.
                throw error;
              }
              /** @type {TransferResult} */
              const transferResult = {
                success: true,
              };
              return transferResult;
            })
            .catch(error => {
              // Not so bad, we can return a refund to the caller.
              const refund = localMint.mintPayment(amount);
              /** @type {TransferResult} */
              const transferResult = {
                success: false,
                error,
                refund,
              };
              return transferResult;
            });
        },
      });

      /** @type {PegDescriptor} */
      const pegDescriptor = harden({
        mint: localMint, // FIXME!!!!!  Don't do this!
        denomUri,
        endpoint,
        issuer: localIssuer,
      });
      return Promise.resolve([courier, pegDescriptor]);
    },

    /**
     * Peg a local asset over a network connection.
     *
     * @param {Connection|PromiseLike<Connection>} c The network connection (IBC channel) to communicate over
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
