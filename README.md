# Pegasus

**The web site is https://peg-as.us**

This is a dapp for pegging [Agoric chain](https://agoric.com) erights to or from other assets across the [Agoric Network API](https://github.com/Agoric/agoric-sdk/blob/master/packages/SwingSet/docs/networking.md).  The Network API notably supports a Javascript contract using our dynamic version of the Inter-Blockchain Communication protocol ([IBC](https://cosmos.network/ibc)).

We currently use the Interchain Standard fungible asset transfer protocol ([ics20-1](https://github.com/cosmos/ics/tree/master/spec/ics-020-fungible-token-transfer)) concrete JSON representation at the data layer.  This combination supports compatibility with conforming ICS20 implementations such as pegging [Cosmos](https://cosmos.network) Atoms via IBC to an upcoming version of the Gaia hub.

See the [detailed documentation](https://docs.google.com/document/d/1m62GfGBxt0RhLx0x9qZJ907uEUsXYY4BRu-JsPhZ620/edit)

# Example

## First User

```sh
# ...
agoric start
# Set up the demo environment in your ag-solo.
agoric deploy contract/deploy.js api/deploy.js
```

In the Wallet/REPL at http://localhost:8000, notice that you have no Atoms.

```sh
# Create the peg to Gaia atoms, and immediately tap the faucet to get some.
agoric deploy ui/makepeg.js
```

In the Wallet, notice that you have Atoms.

You can put them up for sale, and use them in any kind of exchange.

## Second user

```sh
# Register petnames for the Atom issuer in your wallet:
agoric deploy ui/deploy.js
```

Obtain some Atoms on Agoric, via an exchange of some kind.

```sh
# Construct an offer to transfer back to Gaia in the REPL:
EXTENT=75 PURSE='Hard Earned Atoms' RECEIVER='cosmos1235566' agoric deploy ui/transfer.js
```

Accept the offer in your wallet.

Check the Gaia side of things; you should have received your Atoms!
```js
E(home.uploads).get('gaiaPeg').then(val => gaiaPeg = val)
// Your address on Gaia.
depositAddress = 'cosmos12398575697579';
// Create a hook to get the transfer invitation to a Gaia address.
hooks = { publicAPI: { getInvite(publicAPI) { return E(publicAPI).makeInviteToTransfer(gaiaPeg, depositAddress); }}}
// Fill out the proposal template.
E(home.uploads).get('pegasus').then(val => instanceRegKey = val)
pursePetname = 'Atomz fer realz'
extent = 75
offer = { id: 12354656, instanceRegKey, proposalTemplate: { give: { Transfer: { pursePetname, extent } }} }
E(home.wallet).addOffer(offer, hooks)
```
