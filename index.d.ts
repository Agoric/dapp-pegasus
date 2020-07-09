/**
 * @typedef {import('@agoric/ertp/src/issuer').Amount} Amount
 * @typedef {import('@agoric/ertp/src/issuer').Brand} Brand
 * @typedef {import('@agoric/ertp/src/issuer').Issuer} Issuer
 * @typedef {import('@agoric/ertp/src/issuer').Payment} Payment
 * @typedef {import('@agoric/ertp/src/issuer').PaymentP} PaymentP
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Bytes} Bytes
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Data} Data
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Connection} Connection
 * @typedef {import('@agoric/swingset-vat/src/vats/network').ConnectionHandler} ConnectionHandler
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Endpoint} Endpoint
 * @typedef {import('@agoric/zoe').OfferHook} OfferHook
 * @typedef {import('@agoric/zoe').OfferHandle} OfferHandle
 * @typedef {import('@agoric/zoe').Keyword} Keyword
 * @typedef {import('@agoric/zoe').ContractFacet} ContractFacet
 * @typedef {import('@agoric/zoe').Invite} Invite
 * @typedef {import('@agoric/zoe').OfferResultRecord} OfferResultRecord
 */
/**
 * @param {ContractFacet} zcf
 * @returns {Promise<OfferResultRecord>}
 */
export function makeEmptyOfferWithResult(zcf: any): Promise<OfferResultRecord>;
export type Amount = any;
export type Brand = any;
export type Issuer = any;
export type Payment = any;
export type PaymentP = any;
export type Bytes = any;
export type Data = any;
export type Connection = any;
export type ConnectionHandler = any;
export type Endpoint = any;
export type OfferHook = any;
export type OfferHandle = any;
export type Keyword = any;
export type ContractFacet = any;
export type Invite = any;
export type OfferResultRecord = any;
/**
 * <K,V>
 */
export type Store<K, V> = any;
/**
 * <K,V>
 */
export type WeakStore<K, V> = any;
export type DenomUri = string;
export type Denom = string;
export type DepositAddress = string;
export type TransferProtocol = string;
export type PegDescriptor = {
    brand: any;
    denomUri: DenomUri;
    endpoint: any;
};
export type FungibleTransferPacket = {
    /**
     * The extent of the amount
     */
    amount: string;
    /**
     * The denomination of the amount
     */
    denomination: Denom;
    /**
     * The sender address
     */
    sender: string;
    /**
     * The receiver deposit address
     */
    receiver: DepositAddress;
};
export type TransferResult = {
    /**
     * True if the transfer was successful
     */
    success: boolean;
    /**
     * The description of the error
     */
    error?: any;
    /**
     * The refund if the transfer is known to have failed
     */
    refund?: any;
};
export type Courier = {
    /**
     * Successive transfers are not guaranteed to be processed in the order in which they were sent.
     */
    transfer: (payment: any, depositAddress: DepositAddress) => Promise<TransferResult>;
};
export type Receiver = (packet: FungibleTransferPacket) => Promise<unknown>;
/**
 * @type {import('@agoric/zoe').MakeContract}
 */
export const makeContract: any;
/**
 * Make a Pegasus public API.
 *
 * @param {ContractFacet} zcf the Zoe Contract Facet
 * @param {{ getValue: (id: string) => any }} board where to find depositFacets
 */
export function makePegasus(zcf: any, board: {
    getValue: (id: string) => any;
}): {
    getDenomUri: typeof getDenomUri;
    /**
     * Return a handler that can be used with the Network API.
     * @returns {ConnectionHandler}
     */
    makePegConnectionHandler(): any;
    /**
     * Peg a remote asset over a network connection.
     *
     * @param {Connection|PromiseLike<Connection>} connectionP The network connection (IBC channel) to communicate over
     * @param {Denom} remoteDenom Remote denomination
     * @param {string} [amountMathKind=DEFAULT_AMOUNT_MATH_KIND] The kind of amount math for the pegged extents
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL]
     * @returns {Promise<PegDescriptor>}
     */
    pegRemote(connectionP: Connection | PromiseLike<Connection>, remoteDenom: Denom, amountMathKind?: string, protocol?: TransferProtocol): Promise<PegDescriptor>;
    /**
     * Peg a local asset over a network connection.
     *
     * @param {Connection|PromiseLike<Connection>} c The network connection (IBC channel) to communicate over
     * @param {Issuer} issuer Local ERTP issuer whose assets should be pegged to c
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] Protocol to speak on the connection
     * @returns {Promise<[Courier,PegDescriptor]>}
     */
    pegLocal(c: Connection | PromiseLike<Connection>, issuer: any, protocol?: TransferProtocol): Promise<[Courier, PegDescriptor]>;
    /**
     * Find one of our registered issuers.
     * @param {Brand} brand
     * @returns {Promise<Issuer>}
     */
    getIssuer(brand: any): Promise<Issuer>;
    /**
     * Create a Zoe invite to transfer assets over desc to a deposit address.
     *
     * @param {PegDescriptor} desc
     * @param {DepositAddress} depositAddress
     * @returns {Promise<Invite>}
     */
    makeInviteToTransfer(desc: PegDescriptor, depositAddress: DepositAddress): Promise<Invite>;
};
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
 * @typedef {Object} PegDescriptor
 * @property {Brand} brand
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
 * @property {(payment: PaymentP, depositAddress: DepositAddress) => Promise<TransferResult>} transfer
 * Successive transfers are not guaranteed to be processed in the order in which they were sent.
 */
/**
 * @typedef {(packet: FungibleTransferPacket) => Promise<unknown>} Receiver
 */
/**
 * Get the denomination combined with the network address.
 *
 * @param {Endpoint|PromiseLike<Endpoint>} endpointP network connection address
 * @param {Denom} denom denomination
 * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] the protocol to use
 * @returns {Promise<string>} denomination URI scoped to endpoint
 */
declare function getDenomUri(endpointP: Endpoint | PromiseLike<Endpoint>, denom: Denom, protocol?: TransferProtocol): Promise<string>;
export {};
