# Example

```js
// someone asked Peg for an IBC channel to carry `uatom`
const connection = home.ibcPort[1]~.connect(...);
await peg~.pegRemote(connection, 'uatom')
```

```
# Alice makes a transfer of $100ATOM from Gaia to Alice's Agoric Wallet (0x1234=BoardEntryID)
# rly tx xfer gaia agoric 1000000000uatom 0x1234 true
# gaiacli tx transfer transfer transferport xferchannel now+1000blocks 0x1234 100000000uatomAliceG -> AliceA: $100 Atom
# Alice uses SimpleExchange to sell $100 Atom for 200 Moola
AliceA -> SimpleEx: $100 Atom
BobA -> SimpleEx: 200 Moola
SimpleEx -> AliceA: 200 Moola
SimpleEx -> BobA: $100 Atom
# Bob transfers the $100 Atom to his Gaia account
# peg~.send(payment, 'cosmos19uhd9037idh3298673902dhi93')
BobA -> BobG: $100 Atom
```

## Design

One Agoric IBC Port, many Agoric IBC Channels connected to other chains

One Agoric IBC Channel, many remote denoms ("denomination codes")

Each remote denom has exactly one local Agoric issuer

First, open a network connection (such as dIBC), then:

This contract:
1. Root on IBC, shadow on Agoric:
  a. for a given network connection, register the remote denom (computed from IBC address),
  b. create a backing issuer to mint/burn on Agoric
  c. register that issuer with the Board, and allow wallets to install the issuer
  d. internal mapping of channel receiver to peg, and sent brand to peg

2. Root on Agoric, shadow on IBC:
  a. for a given network connection, register an Agoric issuer
  b. generate a name for the IBC denom(ination) `${ibcPortId}/${ibcChannelId}/${nonce}`
  c. create a "backing purse", etc.
  d. handle .sendVia escrow, and .receive unescrow, then message network
  
Contract Public API:

```js
peg.send(payment, destAddress)
peg.sendVia(payment, destAddress, viaNetworkAddress)
peg.pegIssuer(connection, agoricIssuer)
peg.pegRemote(connection, denom, mathName = 'nat')
/**
 * @typedef {Object} RemotePeg
 * @property 
 */
const { issuer, denom, networkAddress } = peg.getRemoteByBrand(issuerBrand)
const { issuer, denom, networkAddress } = peg.getRemoteByAddress(denom, networkAddress)
const { denom, }
```

Internal API for each Peg:

```js
pegAtom.receive(extent, destBoardEntryId)
pegAtom.send(payment, destAddress)
```
