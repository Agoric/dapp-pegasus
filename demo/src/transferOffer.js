import { E } from '@agoric/eventual-send';

// This needs to be run on ag-solo if invitationArgs are presences.
export default async function addOffer({ invitationMethod, invitationArgs, offer, meta, wallet }) {
  const hooks = {
    publicAPI: {
      getInvitation(papi) {
        return E(papi)[invitationMethod](...invitationArgs);
      }
    },
  };

  await E(wallet).addOffer(offer, hooks, meta);
}
