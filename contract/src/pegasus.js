// @ts-check

// eslint-disable-next-line spaced-comment
/// <reference types="ses"/>

import { assert, details, q } from '@agoric/assert';
import produceIssuer from '@agoric/ertp';
import { produceNotifier } from '@agoric/notifier';
import makeStore from '@agoric/store';
import makeWeakStore from '@agoric/weak-store';
import { E } from '@agoric/eventual-send';
import Nat from '@agoric/nat';
import { parse as parseMultiaddr } from '@agoric/swingset-vat/src/vats/network/multiaddr';

import { makeZoeHelpers } from '@agoric/zoe/src/contractSupport';

import { makeZoeHelpers as makeOurZoeHelpers } from './helpers';

const DEFAULT_AMOUNT_MATH_KIND = 'nat';
const DEFAULT_PROTOCOL = 'ics20-1';

/**
 * @typedef {import('@agoric/ertp/src/issuer').Amount} Amount
 * @typedef {import('@agoric/ertp/src/issuer').Brand} Brand
 * @typedef {import('@agoric/ertp/src/issuer').Issuer} Issuer
 * @typedef {import('@agoric/ertp/src/issuer').Payment} Payment
 * @typedef {import('@agoric/ertp/src/issuer').PaymentP} PaymentP
 * @typedef {import('@agoric/notifier').Notifier} Notifier
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Bytes} Bytes
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Data} Data
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Connection} Connection
 * @typedef {import('@agoric/swingset-vat/src/vats/network').ConnectionHandler} ConnectionHandler
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Endpoint} Endpoint
 * @typedef {import('@agoric/zoe').OfferHook} OfferHook
 * @typedef {import('@agoric/zoe').ContractFacet} ContractFacet
 * @typedef {import('@agoric/zoe').Invite} Invite
 */

/**
 * @template K,V
 * @typedef {import('@agoric/store').Store<K,V>} Store<K,V>
 */

/**
 * @template K,V
 * @typedef {import('@agoric/weak-store').WeakStore<K,V>} WeakStore<K,V>
 */

/**
 * @typedef {string} DenomUri
 * @typedef {string} Denom
 * @typedef {string} DepositAddress
 * @typedef {string} TransferProtocol
 *
 * @typedef {Object} Peg
 * @property {() => string} getAllegedName
 * @property {() => Brand} getLocalBrand
 * @property {() => DenomUri} getDenomUri
 *
 * @typedef {Object} PegDescriptor
 * @property {Brand} localBrand
 * @property {DenomUri} denomUri
 * @property {string} allegedName
 */

/**
 * @typedef {Object} BoardDepositFacet a registry for depositAddresses
 * @property {(id: DepositAddress) => any} getValue return the corresponding
 */

/**
 * @typedef {Object} FungibleTransferPacket
 * @property {string} amount The extent of the amount
 * @property {Denom} denomination The denomination of the amount
 * @property {string} [sender] The sender address
 * @property {DepositAddress} receiver The receiver deposit address
 */

/**
 * @typedef {Object} TransferResult
 * @property {boolean} success True if the transfer was successful
 * @property {any} [error] The description of the error
 * @property {Payment} [refund] The refund if the transfer is known to have failed
 */

/**
 * @typedef {(payment: PaymentP, depositAddress: DepositAddress) => Promise<TransferResult>} Sender
 * Successive transfers are not guaranteed to be processed in the order in which they were sent.
 * @typedef {(packet: FungibleTransferPacket) => Promise<unknown>} Receiver
 * @typedef {Object} Courier
 * @property {Sender} send
 * @property {Receiver} receive
 */

/**
 * Get the denomination combined with the network address.
 *
 * @param {Endpoint|PromiseLike<Endpoint>} endpointP network connection address
 * @param {Denom} denom denomination
 * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] the protocol to use
 * @returns {Promise<string>} denomination URI scoped to endpoint
 */
async function makeDenomUri(endpointP, denom, protocol = DEFAULT_PROTOCOL) {
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
 * Translate to and from local tokens.
 * @param {Brand} localBrand
 * @param {string} prefixedDenom
 */
function makeICS20Converter(localBrand, prefixedDenom) {
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
   * @returns {FungibleTransferPacket}
   */
  function localAmountToPacket(amount, depositAddress) {
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
    });
  }

  return { localAmountToPacket, packetToLocalAmount };
}

/**
 * Send the transfer packet and return a status.
 *
 * @param {Connection} c
 * @param {FungibleTransferPacket} packet
 * @returns {Promise<TransferResult>}
 */
const sendTransferPacket = async (c, packet) => {
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
      return {
        success: true,
      };
    });
};

/**
 * Create the [send, receive] pair.
 *
 * @typedef {Object} CourierArgs
 * @property {Connection} connection
 * @property {BoardDepositFacet} board
 * @property {DenomUri} denomUri
 * @property {Issuer} localIssuer
 * @property {Brand} localBrand
 * @property {(payment: Payment, amount: Amount) => Promise<unknown>} retain
 * @property {(amount: Amount) => Promise<Payment>} redeem
 * @param {CourierArgs} arg0
 * @returns {Courier}
 */
const makeCourier = ({
  connection,
  board,
  denomUri,
  localIssuer,
  localBrand,
  retain,
  redeem,
}) => {
  const uriMatch = denomUri.match(/^[^:]+:(.*)$/);
  assert(uriMatch, details`denomUri ${q(denomUri)} does not look like a URI`);
  const prefixedDenom = uriMatch[1];

  const { localAmountToPacket, packetToLocalAmount } = makeICS20Converter(
    localBrand,
    prefixedDenom,
  );

  /** @type {Sender} */
  const send = async (paymentP, depositAddress) => {
    const [amount, payment] = await Promise.all([
      E(localIssuer).getAmountOf(paymentP),
      paymentP,
    ]);
    const packet = localAmountToPacket(amount, depositAddress);

    // Retain the payment.  We must not proceed on failure.
    await retain(payment, amount);

    // The payment is escrowed, so try sending.
    return sendTransferPacket(connection, packet).catch(async error => {
      // NOTE: Only do this if the *transfer* failed.
      // Not so bad, we can return a refund.
      const refund = await redeem(amount);
      /** @type {TransferResult} */
      const transferResult = {
        success: false,
        error,
        refund,
      };
      return transferResult;
    });
  };

  /** @type {Receiver} */
  const receive = async packet => {
    // Look up the deposit facet for this board address, if there is one.
    const depositAddress = packet.receiver;
    const localAmount = packetToLocalAmount(packet);
    const depositFacet = await E(board).getValue(depositAddress);

    // Redeem the backing payment.
    const payment = await redeem(localAmount);

    // Send to the deposit facet, if we can.
    return E(depositFacet).receive(payment);
  };

  return { send, receive };
};

/**
 * Make a Pegasus public API.
 *
 * @param {ContractFacet} zcf the Zoe Contract Facet
 * @param {BoardDepositFacet} board where to find depositFacets
 */
const makePegasus = (zcf, board) => {
  const { checkHook, escrowAndAllocateTo } = makeZoeHelpers(zcf);
  const { unescrow } = makeOurZoeHelpers(zcf);

  const { notifier, updater } = produceNotifier();

  /**
   * @typedef {Object} LocalDenomState
   * @property {Store<DenomUri, Courier>} denomUriToCourier
   * @property {Set<Peg>} pegs
   * @property {number} lastNonce
   */

  /**
   * @type {WeakStore<Connection, LocalDenomState>}
   */
  const connectionToLocalDenomState = makeWeakStore('Connection');

  /**
   * @type {WeakStore<Brand, Issuer>}
   */
  const brandToIssuer = makeWeakStore('Brand');

  let lastLocalIssuerNonce = 0;
  /**
   * Register a brand and issuer with the zcf.
   * @param {Brand} localBrand
   * @param {Issuer} localIssuer
   */
  const registerBrand = async (localBrand, localIssuer) => {
    if (brandToIssuer.has(localBrand)) {
      // Already exists.
      return;
    }
    lastLocalIssuerNonce += 1;
    const localIssuerKeyword = `Local${lastLocalIssuerNonce}`;
    await zcf.addNewIssuer(localIssuer, localIssuerKeyword);
    brandToIssuer.init(localBrand, localIssuer);
  };

  /**
   * @type {Store<Peg, Connection>}
   */
  const pegToConnection = makeStore('Peg');

  /**
   * Create a fresh Peg associated with a descriptor.
   *
   * @param {Connection} c
   * @param {PegDescriptor} desc
   * @param {Set<Peg>} pegs
   * @returns {Peg}
   */
  const makePeg = (c, desc, pegs) => {
    /** @type {Peg} */
    const peg = harden({
      getAllegedName() {
        return desc.allegedName;
      },
      getLocalBrand() {
        return desc.localBrand;
      },
      getDenomUri() {
        return desc.denomUri;
      },
    });

    pegs.add(peg);
    pegToConnection.init(peg, c);
    updater.updateState([...pegToConnection.keys()]);
    return peg;
  };

  return harden({
    makeDenomUri,
    /**
     * Return a handler that can be used with the Network API.
     * @returns {ConnectionHandler}
     */
    makePegConnectionHandler() {
      /**
       * @type {Store<DenomUri, Courier>}
       */
      const denomUriToCourier = makeStore('Denomination');
      /**
       * @type {Set<Peg>}
       */
      const pegs = new Set();
      return {
        async onOpen(c) {
          // Register C with the table of Peg receivers.
          connectionToLocalDenomState.init(c, {
            denomUriToCourier,
            pegs,
            lastNonce: 0,
          });
        },
        async onReceive(c, packetBytes) {
          // Dispatch the packet to the appropriate Peg for this connection.
          /**
           * @type {FungibleTransferPacket}
           */
          const packet = JSON.parse(packetBytes);
          const denomUri = `ics20-1:${packet.denomination}`;
          const { receive } = denomUriToCourier.get(denomUri);
          return receive(packet)
            .then(_ => {
              const ack = { success: true };
              return JSON.stringify(ack);
            })
            .catch(error => {
              // On failure, just return the stringified error.
              const nack = { success: false, error: `${error}` };
              return JSON.stringify(nack);
            });
        },
        async onClose(c) {
          // Unregister C.  Pending transfers will be rejected by the Network API.
          connectionToLocalDenomState.delete(c);
          for (const peg of pegs.keys()) {
            pegToConnection.delete(peg);
          }
        },
      };
    },
    /**
     * Peg a remote asset over a network connection.
     *
     * @param {string} allegedName
     * @param {Connection|PromiseLike<Connection>} connectionP The network connection (IBC channel) to communicate over
     * @param {Denom} remoteDenom Remote denomination
     * @param {string} [amountMathKind=DEFAULT_AMOUNT_MATH_KIND] The kind of amount math for the pegged extents
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL]
     * @returns {Promise<Peg>}
     */
    async pegRemote(
      allegedName,
      connectionP,
      remoteDenom,
      amountMathKind = DEFAULT_AMOUNT_MATH_KIND,
      protocol = DEFAULT_PROTOCOL,
    ) {
      // Assertions
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

      const c = await connectionP;
      assert(
        connectionToLocalDenomState.has(c),
        details`The connection must use .createPegConnectionHandler()`,
      );

      // Find our data elements.
      const allegedLocalAddress = await E(c).getLocalAddress();
      const denomUri = await makeDenomUri(
        allegedLocalAddress,
        remoteDenom,
        protocol,
      );

      // Create the issuer for the local erights corresponding to the remote values.
      const {
        issuer: localIssuer,
        mint: localMint,
        brand: localBrand,
      } = produceIssuer(denomUri, amountMathKind);

      // Ensure the issuer can be used in Zoe offers.
      await registerBrand(localBrand, localIssuer);

      // Describe how to retain/redeem pegged shadow erights.
      const courier = makeCourier({
        connection: c,
        board,
        denomUri,
        localIssuer,
        localBrand,
        retain: (payment, amount) =>
          localIssuer.burn(localIssuer.claim(payment, amount)),
        redeem: amount => E(localMint).mintPayment(amount),
      });

      const { denomUriToCourier, pegs } = connectionToLocalDenomState.get(c);
      denomUriToCourier.init(denomUri, courier);

      return makePeg(c, { localBrand, denomUri, allegedName }, pegs);
    },

    /**
     * Peg a local asset over a network connection.
     *
     * @param {string} allegedName
     * @param {Connection|PromiseLike<Connection>} connectionP The network connection (IBC channel) to communicate over
     * @param {Issuer} localIssuer Local ERTP issuer whose assets should be pegged to c
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] Protocol to speak on the connection
     * @returns {Promise<Peg>}
     */
    async pegLocal(
      allegedName,
      connectionP,
      localIssuer,
      protocol = DEFAULT_PROTOCOL,
    ) {
      // Assertions
      assert(
        protocol === 'ics20-1',
        details`Unimplemented protocol ${q(protocol)}; need "ics20-1"`,
      );

      const c = await connectionP;
      assert(
        connectionToLocalDenomState.has(c),
        details`The connection must use .createPegConnectionHandler()`,
      );

      // We need the last nonce for our denom name.
      const localDenomState = connectionToLocalDenomState.get(c);
      localDenomState.lastNonce += 1;
      const denom = `pegasus${localDenomState.lastNonce}`;

      // Find our data elements.
      const allegedLocalAddress = await E(c).getLocalAddress();
      const denomUri = await makeDenomUri(allegedLocalAddress, denom, protocol);

      // Create a purse in which to keep our denomination.
      const [backingPurse, localBrand] = await Promise.all([
        E(localIssuer).makeEmptyPurse(),
        E(localIssuer).getLocalBrand(),
      ]);

      // Ensure the issuer can be used in Zoe offers.
      await registerBrand(localBrand, localIssuer);

      // Describe how to retain/redeem real local erights.
      const courier = makeCourier({
        connection: c,
        board,
        denomUri,
        localIssuer,
        localBrand,
        retain: (payment, amount) => E(backingPurse).deposit(payment, amount),
        redeem: amount => E(backingPurse).withdraw(amount),
      });

      const { denomUriToCourier, pegs } = localDenomState;
      denomUriToCourier.init(denomUri, courier);

      return makePeg(c, { localBrand, denomUri, allegedName }, pegs);
    },

    /**
     * Find one of our registered issuers.
     * @param {Brand} localBrand
     * @returns {Promise<Issuer>}
     */
    async getLocalIssuer(localBrand) {
      return brandToIssuer.get(localBrand);
    },

    /**
     * Get all the created pegs.
     * @returns {Promise<Notifier>}
     */
    async getNotifier() {
      return notifier;
    },

    /**
     * Create a Zoe invite to transfer assets over network to a deposit address.
     *
     * @param {Peg|Promise<Peg>} pegP
     * @param {DepositAddress} depositAddress
     * @returns {Promise<Invite>}
     */
    async makeInviteToTransfer(pegP, depositAddress) {
      // Verify the peg.
      const peg = await pegP;
      const c = pegToConnection.get(peg);

      // Get details from the peg.
      const [localBrand, denomUri] = await Promise.all([
        E(peg).getLocalBrand(),
        E(peg).getDenomUri(),
      ]);
      const { denomUriToCourier } = connectionToLocalDenomState.get(c);
      const { send } = denomUriToCourier.get(denomUri);

      /**
       * @type {OfferHook}
       */
      const offerHook = async offerHandle => {
        const everything = zcf.getCurrentAllocation(offerHandle).Transfer;

        assert(
          everything.brand === localBrand,
          details`Transfer brand doesn't match Pegasus handle's localBrand`,
        );

        // Fetch the transfer payment.
        const transferPaymentP = unescrow({
          amount: everything,
          keyword: 'Transfer',
          donorHandle: offerHandle,
        });

        // Attempt the transfer, returning a refund if failed.
        const { success, error, refund } = await send(
          transferPaymentP,
          depositAddress,
        );

        if (success) {
          // They got what they wanted!
          zcf.complete([offerHandle]);
          return;
        }

        if (!refund) {
          // There's nothing we can do, since the transfer protocol
          // failed to give us the refund.
          zcf.complete(harden([offerHandle]));
          throw error;
        }

        // Return the refund to the player.
        await escrowAndAllocateTo({
          amount: everything,
          payment: refund,
          keyword: 'Transfer',
          recipientHandle: offerHandle,
        });
        zcf.complete(harden([offerHandle]));
        throw error;
      };

      const transferExpected = harden({
        give: {
          Transfer: null,
        },
      });
      return zcf.makeInvitation(
        checkHook(offerHook, transferExpected),
        'pegasus transfer',
      );
    },
  });
};

/**
 * @typedef {ReturnType<typeof makePegasus>} Pegasus
 */

/**
 * @type {import('@agoric/zoe').MakeContract}
 */
const makeContract = zcf => {
  const { board } = zcf.getInstanceRecord().terms;

  const publicAPI = makePegasus(zcf, board);
  zcf.initPublicAPI(publicAPI);

  const adminHook = _offerHandle => {
    return `no administrative capabilities`;
  };
  return zcf.makeInvitation(adminHook, 'admin');
};

harden(makeContract);
harden(makePegasus);
export { makeContract, makePegasus };
