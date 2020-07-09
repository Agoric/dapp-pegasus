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
