import { E } from '@agoric/eventual-send';

// This needs to be run on ag-solo if inviteArgs are presences.
export default async function addOffer({ inviteMethod, inviteArgs, offer, meta, wallet }) {
  const hooks = {
    publicAPI: {
      getInvite(papi) {
        return E(papi)[inviteMethod](...inviteArgs);
      }
    },
  };

  await E(wallet).addOffer(offer, hooks, meta);
}
