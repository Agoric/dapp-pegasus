// @ts-check

import { assert, details, q } from '@agoric/assert';
import { makeNotifierKit } from '@agoric/notifier';
import makeStore from '@agoric/store';
import makeWeakStore from '@agoric/weak-store';
import { E } from '@agoric/eventual-send';
import Nat from '@agoric/nat';
import { parse as parseMultiaddr } from '@agoric/swingset-vat/src/vats/network/multiaddr';
import { assertProposalShape } from '@agoric/zoe/src/contractSupport';

import '@agoric/notifier/exports';
import '../exported';

const DEFAULT_AMOUNT_MATH_KIND = 'nat';
const DEFAULT_PROTOCOL = 'ics20-1';

const TRANSFER_PROPOSAL_SHAPE = {
  give: {
    Transfer: null,
  },
};

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

        // FIXME: We really should get this from the actual endpoint.
        const FIXME_FAKE_CHANNEL = ['ibc-channel', 'transfer'];
        const protoChannel =
          pairs.find(([proto]) => proto === 'ibc-channel') ||
          FIXME_FAKE_CHANNEL;
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
    const floatValue = Number(packet.amount);

    // If we overflow, or don't have a number, throw an exception!
    const value = Nat(floatValue);

    return harden({
      brand: localBrand,
      value,
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
    const { brand, value } = amount;
    assert(
      brand === localBrand,
      details`Brand must our local issuer's, not ${q(brand)}`,
    );
    const stringValue = String(Nat(value));

    // Generate the ics20-1 packet.
    return harden({
      amount: stringValue,
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
 * @returns {Promise<void>}
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
    });
};

/**
 * Create the [send, receive] pair.
 *
 * @typedef {Object} CourierArgs
 * @property {ContractFacet} zcf
 * @property {Connection} connection
 * @property {BoardDepositFacet} board
 * @property {DenomUri} denomUri
 * @property {Brand} localBrand
 * @property {(zcfSeat: ZCFSeat, amounts: AmountKeywordRecord) => void} retain
 * @property {(zcfSeat: ZCFSeat, amounts: AmountKeywordRecord) => void} redeem
 * @param {CourierArgs} arg0
 * @returns {Courier}
 */
const makeCourier = ({
  zcf,
  connection,
  board,
  denomUri,
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
  const send = async (zcfSeat, depositAddress) => {
    const amount = await zcfSeat.getAmountAllocated('Transfer', localBrand);
    const packet = localAmountToPacket(amount, depositAddress);

    // Retain the payment.  We must not proceed on failure.
    retain(zcfSeat, { Transfer: amount });

    // The payment is already escrowed, and proposed to retain, so try sending.
    return sendTransferPacket(connection, packet).then(
      _ => zcfSeat.exit(),
      reason => zcfSeat.kickOut(reason),
    );
  };

  /** @type {Receiver} */
  const receive = async packet => {
    // Look up the deposit facet for this board address, if there is one.
    const depositAddress = packet.receiver;
    const localAmount = packetToLocalAmount(packet);
    const depositFacet = await E(board).getValue(depositAddress);

    const { userSeat, zcfSeat } = zcf.makeEmptySeatKit();

    // Optimistically send the payout promise to the deposit facet.
    E(depositFacet).receive(E(userSeat).getPayout('Transfer'));

    // Redeem the backing payment.
    try {
      redeem(zcfSeat, { Transfer: localAmount });
      zcfSeat.exit();
    } catch (e) {
      zcfSeat.kickOut(e);
    }
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
  /** @type {NotifierRecord<Peg[]>} */
  const { notifier, updater } = makeNotifierKit([]);

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

  let lastLocalIssuerNonce = 0;
  /**
   * Create a new issuer keyword (based on Local + nonce)
   * @returns {string}
   */
  const createLocalIssuerKeyword = () => {
    lastLocalIssuerNonce += 1;
    return `Local${lastLocalIssuerNonce}`;
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
          updater.updateState([...pegToConnection.keys()]);
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
      const localKeyword = createLocalIssuerKeyword();
      const zcfMint = zcf.makeZCFMint(localKeyword, amountMathKind);
      const { brand: localBrand } = zcfMint.getIssuerRecord();

      // Describe how to retain/redeem pegged shadow erights.
      const courier = makeCourier({
        zcf,
        connection: c,
        localBrand,
        board,
        denomUri,
        retain: (zcfSeat, amounts) => zcfMint.burnLosses(amounts, zcfSeat),
        redeem: (zcfSeat, amounts) => {
          zcfMint.mintGains(amounts, zcfSeat);
        },
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

      // Create a seat in which to keep our denomination.
      const { zcfSeat: poolSeat } = zcf.makeEmptySeatKit();

      // Ensure the issuer can be used in Zoe offers.
      const localKeyword = createLocalIssuerKeyword();
      const {
        brand: localBrand,
        amountMath: localAmountMath,
      } = await zcf.saveIssuer(localIssuer, localKeyword);

      /**
       * Transfer amount (of localBrand and localAmountMath) from loser to winner seats.
       * @param {Amount} amount amount to transfer
       * @param {Keyword} loserKeyword the keyword to take from the loser
       * @param {ZCFSeat} loser seat to transfer from
       * @param {Keyword} winnerKeyword the keyword to give to the winner
       * @param {ZCFSeat} winner seat to transfer to
       */
      const transferAmountFrom = (
        amount,
        loserKeyword,
        loser,
        winnerKeyword,
        winner,
      ) => {
        // Transfer the amount to our backing seat.
        const currentLoser = loser.getAmountAllocated(loserKeyword, localBrand);
        const currentWinner = winner.getAmountAllocated(
          winnerKeyword,
          localBrand,
        );
        const newLoser = localAmountMath.subtract(currentLoser, amount);
        const newWinner = localAmountMath.add(currentWinner, amount);
        const loserStage = loser.stage({ [loserKeyword]: newLoser });
        const winnerStage = winner.stage({ [winnerKeyword]: newWinner });
        zcf.reallocate(loserStage, winnerStage);
      };

      // Describe how to retain/redeem real local erights.
      const courier = makeCourier({
        zcf,
        connection: c,
        board,
        denomUri,
        localBrand,
        retain: (transferSeat, amounts) =>
          transferAmountFrom(
            amounts.Transfer,
            'Transfer',
            transferSeat,
            'Pool',
            poolSeat,
          ),
        redeem: (transferSeat, amounts) =>
          transferAmountFrom(
            amounts.Transfer,
            'Pool',
            poolSeat,
            'Transfer',
            transferSeat,
          ),
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
      return zcf.getIssuerForBrand(localBrand);
    },

    /**
     * Get all the created pegs.
     */
    async getNotifier() {
      return notifier;
    },

    /**
     * Create a Zoe invitation to transfer assets over network to a deposit address.
     *
     * @param {ERef<Peg>} pegP the peg over which to transfer
     * @param {DepositAddress} depositAddress the remote receiver's address
     * @returns {Promise<Invitation>} to transfer, make an offer of { give: { Transfer: pegAmount } } to this invitation
     */
    async makeInvitationToTransfer(pegP, depositAddress) {
      // Verify the peg.
      const peg = await pegP;
      const c = pegToConnection.get(peg);

      // Get details from the peg.
      const denomUri = await E(peg).getDenomUri();
      const { denomUriToCourier } = connectionToLocalDenomState.get(c);
      const { send } = denomUriToCourier.get(denomUri);

      /**
       * Attempt the transfer, returning a refund if failed.
       * @type {OfferHandler}
       */
      const offerHandler = zcfSeat => send(zcfSeat, depositAddress);

      return zcf.makeInvitation(
        assertProposalShape(offerHandler, TRANSFER_PROPOSAL_SHAPE),
        'pegasus transfer',
      );
    },
  });
};

/**
 * @typedef {ReturnType<typeof makePegasus>} Pegasus
 */

/**
 * @param {ContractFacet} zcf
 */
const makeContract = zcf => {
  const { board } = zcf.getTerms();

  return {
    publicFacet: makePegasus(zcf, board),
  };
};

harden(makeDenomUri);
harden(makeContract);
harden(makePegasus);
export { makeContract, makePegasus, makeDenomUri };
