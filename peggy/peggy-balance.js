#! /usr/bin/env node

const { spawn } = require('child_process');
const util = require('util');

// peggy keys show -a peggy-cosmos
// const ADDRESS = 'cosmos1nqypqptka5w9eph6kdvguvujnxhmn3l8u9guuc';
const ADDRESS = process.argv[2];
const PORT = process.env.PORT || 5151;

const WebSocket = require('ws');

const BASE_MAGIC_ID = 13254;
const makeQueries = addr => [
  `tm.event='Tx' AND transfer.sender='${addr}'`,
  `tm.event='Tx' AND transfer.recipient='${addr}'`,
];

const spawnUntilSuccess = (...args) =>
  new Promise(resolve => {
    const loop = retry => {
      const cp = spawn(...args);
      cp.on('exit', code => {
        console.log('exit status:', code);
        if (code && retry > 0) {
          setTimeout(() => loop(retry - 1), 3000);
        } else {
          resolve(code);
        }
      });
    };
    loop(10);
  });

if (ADDRESS) {
  console.log(`Subscribing for ${ADDRESS} balances`);
  queryBalances(ADDRESS, balances => {
    const bals = balances
      .map(({ denom, amount }) => `${amount}${denom}`)
      .join('\n');
    if (bals) {
      console.log(bals);
    }
  });
} else {
  console.log('Listening on port', PORT);
  const wss = new WebSocket.Server({ port: PORT });

  wss.on('connection', wc => {
    const unsubs = new Map();
    const send = obj => {
      if (wc.readyState !== wc.OPEN) {
        return;
      }
      wc.send(JSON.stringify(obj));
    };

    wc.on('message', data => {
      const obj = JSON.parse(data);
      console.log('>', obj);
      switch (obj.type) {
        case 'PEGGY_BALANCE_SUBSCRIBE': {
          const address = obj.payload;
          if (unsubs.has(address)) {
            return;
          }
          const streamer = balances =>
            send({ type: 'PEGGY_BALANCE', payload: { address, balances } });
          unsubs.set(address, queryBalances(address, streamer));
          break;
        }

        case 'PEGGY_AGORIC_TRANSFER': {
          const { denom, amount, recipient } = obj.payload;
          spawnUntilSuccess(
            'rly',
            [
              'tx',
              'raw',
              'transfer',
              'peggy-test',
              'agoric',
              `${amount}${denom}`,
              `raw:${recipient}`,
            ],
            { stdio: ['ignore', 'inherit', 'inherit'] },
          );

          break;
        }

        default: {
          // do nothing
          break;
        }
      }
    });

    wc.on('close', () => {
      for (const unsub of unsubs.values()) {
        unsub();
      }
    });
  });
}

function queryBalances(addr, streamBalances) {
  const queries = makeQueries(addr);

  const ws = new WebSocket('ws://127.0.0.1:26657/websocket');
  ws.addEventListener('error', e => {
    console.debug('WebSocket error', e);
  });

  ws.addEventListener('open', _ => {
    queries.forEach((query, i) => {
      const obj = {
        jsonrpc: '2.0',
        id: BASE_MAGIC_ID + i,
        method: 'subscribe',
        params: {
          query,
        },
      };
      ws.send(JSON.stringify(obj));
    });
  });

  ws.addEventListener('message', ev => {
    const obj = JSON.parse(ev.data);
    const query = queries[obj.id - BASE_MAGIC_ID];
    console.log(util.inspect(obj, false, Infinity));
    if (query === undefined) {
      return;
    }
    // console.log('query', query);
    const cp = spawn('peggy', ['query', 'bank', 'balances', '-ojson', addr], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const obufs = [];
    cp.stdout.on('data', chunk => {
      obufs.push(chunk);
    });
    cp.stdout.on('close', () => {
      const js = Buffer.concat(obufs).toString('utf-8');
      const out = JSON.parse(js);
      console.log(out);
      streamBalances(out.balances);
    });
  });

  return () => ws.close();
}
