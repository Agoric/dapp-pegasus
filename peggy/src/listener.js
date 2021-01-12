import { E } from '@agoric/eventual-send';
import { makePromiseKit } from '@agoric/promise-kit';

/**
 * @typedef {import('../../contract/src/pegasus').FungibleTransferPacket} FungibleTransferPacket
 * @typedef {import('@agoric/swingset-vat/src/vats/network').Port} Port
 */

/**
 * @param {{port: Port}} arg0
 */
async function listener({ chandler, port }) {
  // Create a listener for the connection handler.
  const conn = makePromiseKit();
  E(port).addListener({
    async onAccept() {
      let raddr;
      return harden({
        async onOpen(c, localAddr, remoteAddr) {
          raddr = remoteAddr;
          console.info(raddr, 'connecting');
          conn.resolve(c);
          return E(chandler).onOpen(c, localAddr, remoteAddr);
        },
        async onReceive(c, packetBytes) {
          console.info(raddr, '='.repeat(50));
          console.info(packetBytes);
          return E(chandler).onReceive(c, packetBytes);
        },
        async onClose(c) {
          console.info(raddr, 'closing');
          return E(chandler).onClose(c);
        },
      });
    },
  });

  return conn.promise;
}

harden(listener);
export default listener;
