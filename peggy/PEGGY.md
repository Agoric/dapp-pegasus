## Compile the Peggy clients

https://docs.google.com/document/d/1M3NgtHixfxls9bBdNMFpUTqgZohf4NO-QGamDpcPccQ/edit#

```sh
cd peggy/module
make install
# Test that the "peggy" binary was installed.
peggy version --long
```

```sh
cd peggy/orchestrator/client
cargo install --path .
# Test that the "client" binary was installed.
client
```

### Run a Peggy manual demo

If you're running Peggy locally, you'll need to prepare for the demo.

```sh
# DO NOT "Press Return to Close"
peggy/tests/start-chains.sh
# Start in a new terminal
peggy/tests/run-tests.sh MANUAL_DEMO
```

## Check that you can connect

These instructions' constants are taken from the Peggy Testnet #1 document.

```sh
peggy --node=tcp://104.236.19.8:26657 status
# Should print some JSON stuff.
```

### Generate a Cosmos key

Create a key for Peggy.

```sh
peggy keys add peggy-cosmos
```

Record the mnemonic in a safe place.  You will need it immediately to generate a
key for Agoric:

```sh
ag-cosmos-helper keys add peggy-cosmos --recover
```

## Monitor your Peggy balance

```sh
./peggy-balance.js $(peggy keys show -a peggy-cosmos)
```

### Run the peggy client:

From Peggy Testnet #1 documents:

> This private key 
> ```
> 0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7
> ```
>
> Has millions of tokens in these ERC20 contracts on Rinkeby, have fun!
> ```
> 0x3A020A6A407d145de10De0367a767611F1652c06
> 0x95a76bC37Eca834143E61d9F8c8F32da01BdeA1B
> 0x8a0540d474E8D1a96D1c5e5a138232D83f19c6aF
> ```

Transfer some above ERC-20 to Peggy, using the above private key/addresses:

```sh
RUST_LOG=info client eth-to-cosmos \
    	--ethereum-key="0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7" \
    	--ethereum-rpc="http://104.236.19.8:8545" \
    	--contract-address="0xB411f2158e70414921BEA40bC3001F89F6595F22" \
    	--erc20-address="0x95a76bC37Eca834143E61d9F8c8F32da01BdeA1B" \
    	--amount=100 \
    	--cosmos-destination=$(peggy keys show -a peggy-cosmos)
# or:
RUST_LOG=info client eth-to-cosmos \
    	--ethereum-key="0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7" \
    	--ethereum-rpc="http://localhost:8545" \
    	--contract-address="0xD7600ae27C99988A6CD360234062b540F88ECA43" \
    	--erc20-address="0x0412C7c846bb6b7DC462CF6B453f76D8440b2609" \
    	--amount=100 \
    	--cosmos-destination=$(peggy keys show -a peggy-cosmos)
```

Check Peggy balances

```sh
peggy --node=tcp://104.236.19.8:26657 query bank balances \
      $(peggy keys show -a peggy-cosmos)
```

# Set up Agoric chain

```sh
agoric start --reset local-chain 25657
CHAIN_PORT=25657 agoric start --reset local-solo 8000
```

# Transfer over IBC

In REPL (`agoric open --repl`):

```js
home.ibcport[0]~.getLocalAddress()
```

Ensure the correct port-id is specified in `peggy-config.yaml`, then:

## Set up relayer

```sh
cp peggy-config.yaml ~/.relayer/config/config.yaml
```

Make the keys accessible to the relayer:

```sh
ag-cosmos-helper --home=$HOME/.relayer/keys/agoric \
  keys add peggy-cosmos \
  --recover --keyring-backend=test
peggy --home=$HOME/.relayer/keys/peggy-test \
  keys add peggy-cosmos \
  --recover --keyring-backend=test
```

Register a listener for the transfer protocol:

```sh
agoric deploy contract/deploy.js api/deploy.js
agoric deploy peggy/makepeg.js
```

OR

```js
c2=null; home.ibcport[0]~.addListener({ onAccept(p, la, ra) { return { onOpen(c) { c2 = c2 || c; console.log('opened', la, ra) }, onReceive(c, p) { console.log('received', p); return '{"result": "AA=="}'; }} }})
```

Start a channel between transfer ports:

```sh
# Initialize light clients:
rly light init peggy-test -f
rly light init agoric -f
# Check the status of the chains:
rly chains list
# Create a path:
rly tx link three -d
# See the path's status:
rly paths list
# Start a relayer.
rly start three -d
```

Then initiate a transfer:

```sh
rly tx raw transfer peggy-test agoric \
  1peggy0x30dA8589BFa1E509A319489E014d384b87815D89 \
  raw:board:604346717
# Check the balance:
ag-cosmos-helper query bank balances \
  $(ag-cosmos-helper keys show -a peggy-cosmos) \
  --node=tcp://node0.testnet.agoric.com:26657
```

```
received {"amount":"1","denom":"peggy0x30dA8589BFa1E509A319489E014d384b87815D89","receiver":"board:604346717","sender":"cosmos1nqypqptka5w9eph6kdvguvujnxhmn3l8u9guuc"}
```

Should return one of:
```json
{"result": "..."}
```
or:
```json
{"error": "some kinda message"}
```
