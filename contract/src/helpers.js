// @ts-check

import { E } from '@agoric/eventual-send';

/**
 * @param {ContractFacet} zcf the Zoe Contract Facet
 */
const makeZoeHelpers = zcf => {
  /**
   * @returns {Promise<OfferResultRecord>}
   */
  const makeEmptyOfferWithResult = async () => {
    const invite = zcf.makeInvitation(_ => undefined, 'empty offer');
    const zoe = zcf.getZoeService();
    return E(zoe).offer(invite);
  };

  /**
   * Extract a payment from a donorHandle.
   *
   * @param {{amount: Amount, keyword: Keyword, donorHandle: OfferHandle}} arg0
   */
  const unescrow = async ({ amount, keyword, donorHandle }) => {
    const {
      offerHandle: ourOfferHandleP,
      payout: ourPayoutP,
    } = await makeEmptyOfferWithResult();

    const ourOfferHandle = await ourOfferHandleP;
    const originalAmount = zcf.getCurrentAllocation(donorHandle)[keyword];

    // Take the payment from the donor.
    const remaining = zcf
      .getAmountMath(amount.brand)
      .subtract(originalAmount, amount);
    zcf.reallocate(
      [donorHandle, ourOfferHandle],
      [{ [keyword]: remaining }, { [keyword]: amount }],
    );
    zcf.complete(harden([ourOfferHandle]));

    // Wait for the payout to get the payment promise.
    const { [keyword]: paymentP } = await ourPayoutP;

    // The caller can wait.
    return paymentP;
  };

  return { unescrow, makeEmptyOfferWithResult };
};

harden(makeZoeHelpers);
export { makeZoeHelpers };
