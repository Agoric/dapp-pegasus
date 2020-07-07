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
  d. handle receiveFungible unescrow, expose sendFungible escrow, then to network
  
Contract Public API:

contract.sendFungible(payment, destAddress)
contract.sendFungibleVia(payment, destAddress, viaNetworkAddress)
contract.pegIssuer(connection, agoricIssuer)
contract.pegRemoteDenom(connection, 'uatom')

Internal API for each Peg:

peg.receiveFungible(amount, denom, destBoardEntryId)
peg.sendFungible(payment, destAddress)
