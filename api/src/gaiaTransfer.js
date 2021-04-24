import { E } from '@agoric/eventual-send';
import { makeDenomUri } from '@agoric/pegasus';

/**
 * @typedef {import('@agoric/pegasus').FungibleTransferPacket} FungibleTransferPacket
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Port} Port
 */

/**
 * @param {{port: Port}} arg0
 */
async function gaiaTransfer({ port }) {
  // Create a network object and corresponding peg.
  E(port).addListener({
    async onAccept() {
      let raddr;
      return harden({
        async onOpen(c, localAddr, remoteAddr) {
          raddr = remoteAddr;
          console.info('Gaia transfer connection from', remoteAddr);
        },
        async onReceive(c, packetBytes) {
          console.info('='.repeat(50));
          const packet = JSON.parse(packetBytes);
          if (packet.tap === undefined) {
            // Give success as a transfer result.
            const ack = JSON.stringify({
              success: true,
            });
            console.info('Gaia transfer RECEIVE:', packet);
            console.info('Gaia transfer ack:', ack);
            return ack;
          }

          // For demo!
          const denomUri = await makeDenomUri(raddr, 'atom');
          const denomMatch = denomUri.match(/^[^:]+:(.*)/);
          const prefixedDenom = denomMatch[1];
          /**
           * @type {FungibleTransferPacket}
           */
          const packet2 = {
            amount: packet.amount,
            denomination: prefixedDenom,
            receiver: packet.tap,
            sender: 'cosmos1xdecih3cyehciac96heocitece',
          };
          const packetBytes2 = JSON.stringify(packet2);

          console.info('Gaia transfer SEND:', packet2);
          const ack = await E(c).send(packetBytes2);
          console.info('Gaia transfer ack:', ack);
          return ack;
        },
      });
    },
  });
}

harden(gaiaTransfer);
export default gaiaTransfer;
