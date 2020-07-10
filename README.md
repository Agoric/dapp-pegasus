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
