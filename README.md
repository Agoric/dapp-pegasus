# Pegasus

**If you want to transfer value, why not peg-as-us?**

This is a decentralized app (_Dapp_) for pegging/transferring [Agoric](https://agoric.com) erights to or from remote assets via the [Agoric Network API](https://github.com/Agoric/agoric-sdk/blob/master/packages/SwingSet/docs/networking.md).  The Network API notably allows smart contracts written in Javascript to communicate between blockchains via _dIBC_ (our dynamic flavour of [IBC](https://cosmos.network/ibc), the Inter-Blockchain Communication protocol).

Pegasus currently uses the packet data JSON format of the Interchain Standard fungible asset transfer protocol ([ics20-1](https://github.com/cosmos/ics/tree/master/spec/ics-020-fungible-token-transfer)).  The combination of ICS20 and IBC provides compatibility with any conforming implementation such as pegging [Cosmos](https://cosmos.network) Atoms via (an upcoming version of) the Gaia hub.

## References

* [peg-as.us website](https://peg-as.us)
* [Agoric's secure smart contracts in Javascript](https://agoric.com)
* [dapp-pegasus GitHub Repository](https://github.com/agoric/dapp-pegasus)
* [Team Pegasus hackathon writeup](https://docs.google.com/document/d/1m62GfGBxt0RhLx0x9qZJ907uEUsXYY4BRu-JsPhZ620/edit)
* [Agoric's getting started documentation](https://agoric.com/documentation/getting-started/)

# Demo

**CAVEAT: Please note that the Pegasus Dapp UI has not yet been created (we were missing some crucial wallet features at the time of the hackathon).**

Instead, we will use "agoric deploy scripts" to expose issuers to the Agoric wallet, create pegs, and request Zoe invitations to transfer assets over them.

## Number of Wallets

You can run this demo locally in either multiuser mode (separate wallets for Alice and Bob), or in single-user mode (one wallet shared between them).  We recommend familiarising yourself with Agoric's (getting started documentation)[https://agoric.com/documentation/getting-started/].

**EITHER:**

For single-user mode, set up just a sim chain (it runs on port 8000):
```js
agoric start --reset
```

**OR:**

For multiuser mode, see the Agoric documentation (FIXME: link!) for
running `agoric start` processes with two `local-solo` instances (one
for each wallet on TCP ports 8000 and 8001), and a `local-chain`.

## First User - Alice

```sh
# Set up the demo environment in Alice's ag-solo.
agoric deploy contract/deploy.js api/deploy.js
```

In Alice's Wallet/REPL at http://localhost:8000, notice that she has no Atoms.

```sh
# Create the peg to Gaia atoms, and immediately tap the faucet to get some.
agoric deploy demo/makepeg.js
```

In Alice's Wallet, now notice that she has Atoms.

*For the demo simulation, this will mean that a transfer message from Gaia is printed on the `agoric start` console (the `local-chain` logs for multiuser).*

## Segue: Simple Exchange

It's interesting to note that the Atom erights you have can be used in other Agoric smart contracts, completely transparently.

So, Alice can put them up for sale as the configured Asset in a Simple Exchange Dapp:

```sh
# Clone the Pegasus branch of Simple Exchange).
git clone git://github.com/Agoric/dapp-simple-exchange -b pegasus
# Install node dependencies.
(cd dapp-simple-exchange && agoric install)
# Run the deploy scripts.
agoric deploy dapp-simple-exchange/contract/deploy.js dapp-simple-exchange/api/deploy.js
# Run the simplex UI.
(cd dapp-simple-exchange/ui && yarn start)
```

Have Alice navigate to http://localhost:3000 and place an order to sell 75 of her Atoms in exchange for at least 190 moola.

Remember to navigate to Alice's Wallet in order to confirm the order with Zoe.

## Second User - Bob

### Configure the Shell for Bob's Wallet

For single-user mode, continue using the same wallet, but first clear the `$BOB` shell variable:

```sh
# Reset Bob's wallet address to the default (Alice's wallet).
BOB_HOSTPORT=
```

If you are instead running against a local-chain in multiuser mode, you will need to set the `$BOB_HOSTPORT` shell variable to `--hostport=8001`.

### Bob's Interaction

Look at Bob's wallet (http://localhost:8001 in single-user mode), and note that he doesn't know about Atoms.

Now teach Bob's wallet about the pegged Atoms:

```sh
# Register petnames for the Atom issuer in Bob's wallet:
agoric deploy $BOB_HOSTPORT demo/deploy.js
```

Note in the wallet that an Atom purse has been added as `Bob's Atoms`.

Have Bob navigate to Simple Exchange at http://localhost:3000 and place an order to buy at least 70 Atoms (we're being nice) in exchange for least 200 moola (we're being doubly nice).

Remember to navigate back to Bob's Wallet to confirm the order with Zoe and fulfill Alice's book order.

You should see the 75 Atoms (what Alice offered) transferred to Bob's atom purse.

Next, construct a Pegasus transfer to move 20 of the Atoms back to Bob's Gaia account.

```sh
# Construct an offer to transfer back to Gaia in the REPL:
EXTENT=20 RECEIVER="<Bob's Gaia Address>" agoric deploy $BOB_HOSTPORT demo/transfer.js
```

Accept the offer in Bob's wallet.  The 20 atoms are deducted from Bob's Atom purse.

Finally, check Bob's Gaia account; he should have 20 more Atoms in his balance!

*For the demo simulation, this will mean that a transfer message to Gaia is printed on the `agoric start` console (the `local-chain` logs for multiuser).*

# History

* 2020-06-10 - created the Agoric Pegasus contract and first demo (Agoric internal hackathon July 6th-10th, 2020).
