import { E } from '@agoric/eventual-send';
import { makeDenomUri } from '../../contract/src/pegasus';

/**
 * @typedef {import('../../contract/src/pegasus').FungibleTransferPacket} FungibleTransferPacket
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Port} Port
 */

/**
 * @param {{port: Port}} arg0
 */
async function gaiaFaucet({ port }) {
  // Create a network object and corresponding peg.
  E(port).addListener({
    async onAccept() {
      let raddr;
      return harden({
        async onOpen(c, localAddr, remoteAddr) {
          raddr = remoteAddr;
          console.info('Gaia faucet connection from', remoteAddr);
        },
        async onReceive(c, packetBytes) {
          console.info('Received inbound Gaia request', packetBytes);

          const packet = JSON.parse(packetBytes);
          if (packet.tap === undefined) {
            // Give success as a transfer result.
            console.info(`\
=======================
TRANSFER SUCCESS FOR ${packet.amount}${packet.denomination} TO ${receiver}
=======================
`)
            return JSON.stringify({
              success: true,
            });
          }

          // For demo!
          const denomUri = await makeDenomUri(raddr, 'atom');
          const denomMatch = denomUri.match(/^[^:]+:(.*)/);
          const prefixedDenom = denomMatch[1];
          /**
           * @type {FungibleTransferPacket}
           */
          const transferPacket = {
            amount: 100,
            denomination: prefixedDenom,
            receiver: packet.tap,
            sender: 'cosmos1xdecih3cyehciac96heocitece',
          }
          return E(c).send(JSON.stringify(transferPacket));
        },
      });
    },
  });
}

harden(gaiaFaucet);
export default gaiaFaucet;
