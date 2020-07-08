export default makePeg;
export type Amount = any;
export type Brand = any;
export type Issuer = any;
export type Payment = any;
export type Connection = any;
export type Endpoint = any;
export type DenomUri = string;
export type Denom = string;
export type DepositAddress = string;
export type TransferProtocol = string;
export type PegDescriptor = {
    issuer: any;
    denomUri: DenomUri;
    endpoint: any;
};
export type Courier = {
    transfer: (payment: any, depositAddress: DepositAddress) => Promise<void>;
};
/**
 * Create the public facet of the pegging contract.
 */
declare function makePeg(): {
    getDenomUri: (endpointP: Endpoint | PromiseLike<Endpoint>, denom: Denom, protocol?: TransferProtocol) => Promise<string>;
    /**
     * Peg a remote asset over a network connection.
     *
     * @param {Connection} c The network connection (IBC channel) to communicate over
     * @param {Denom} denom Remote denomination
     * @param {string} [amountMathKind=DEFAULT_AMOUNT_MATH_KIND] The kind of amount math for the pegged extents
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL]
     * @returns {Promise<[Courier,PegDescriptor]>}
     */
    pegRemote(c: any, denom: Denom, amountMathKind?: string, protocol?: TransferProtocol): Promise<[Courier, PegDescriptor]>;
    /**
     * Peg a local asset over a network connection.
     *
     * @param {Promise<Connection>|Connection} c The network connection (IBC channel) to communicate over
     * @param {Issuer} issuer Local ERTP issuer whose assets should be pegged to c
     * @param {TransferProtocol} [protocol=DEFAULT_PROTOCOL] Protocol to speak on the connection
     * @returns {Promise<[Courier,PegDescriptor]>}
     */
    pegLocal(c: Promise<Connection> | Connection, issuer: any, protocol?: TransferProtocol): Promise<[Courier, PegDescriptor]>;
    /**
     * Look up a peg by brand.
     *
     * @param {Brand} brand
     * @returns {PegDescriptor?}
     */
    getPegByBrand(brand: any): PegDescriptor | null;
    /**
     * Look up pegs by endpoint.
     *
     * @param {Endpoint} endpoint
     * @returns {PegDescriptor[]}
     */
    getPegByEndpoint(endpoint: any): PegDescriptor[];
};
