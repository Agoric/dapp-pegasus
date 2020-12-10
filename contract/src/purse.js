import { assert, details } from '@agoric/assert';
import { makeNotifierKit } from '@agoric/notifier';
import { isPromise } from '@agoric/promise-kit';

// TODO: add `makeExternalStore` and `Remotable` back in

const makeDepositFacet = purse => ({
  receive: purse.deposit,
});

// mint, brand, amountMath, and issuer are assumed to be in this same
// vat
/**
 *
 * @param {Mint} mint
 * @param {Brand} brand
 * @param {AmountMath} amountMath
 * @param {Issuer} issuer
 * @param {Amount} initialBalance
 */
export const makePurse = (mint, brand, amountMath, issuer, initialBalance) => {
  const depositFacet = makeDepositFacet();

  const assertAmountEqual = (paymentBalance, amount) => {
    if (amount !== undefined) {
      assert(
        amountMath.isEqual(amount, paymentBalance),
        details`payment balance ${paymentBalance} must equal amount ${amount}`,
      );
    }
  };

  const assertKnownPayment = async allegedPayment => {
    const isLive = await issuer.isLive(allegedPayment);

    // TODO: original had allegedName
    assert(isLive, `payment not found`);
  };

  /** @type {NotifierRecord<Amount>} */
  const {
    notifier: balanceNotifier,
    updater: balanceUpdater,
  } = makeNotifierKit(initialBalance);

  const signTransferFromUserPeggyAccountToIBCTransferModuleOnPeggy = () => {
    // TODO: magic that can't be done within pegasus because it
    // doesn't have the private keys for a user
  };

  const getCurrentBalance = () => {
    // TODO: some magic going to peggy chain or cosmos-sdk
    return balance;
  };

  const sendToRemote = amount => {
    // TODO: some magic going to the peggy chain or cosmos-sdk
  };

  const purse = harden({
    deposit: async (srcPayment, optAmount = undefined) => {
      if (isPromise(srcPayment)) {
        throw new TypeError(
          `deposit does not accept promises as first argument. Instead of passing the promise (deposit(paymentPromise)), consider unwrapping the promise first: paymentPromise.then(actualPayment => deposit(actualPayment))`,
        );
      }
      assertKnownPayment(srcPayment);
      const srcPaymentBalance = await issuer.getAmountOf(srcPayment);
      // Note: this does not guarantee that optAmount itself is a valid stable amount
      assertAmountEqual(srcPaymentBalance, optAmount);
      // Commit point
      // Move the assets in `srcPayment` into this purse, using up the
      // source payment, such that total assets are conserved.
      await issuer.burn(srcPayment);
      sendToRemote(srcPaymentBalance);
      // TODO: when to update balanceUpdater?
      // balanceUpdater.updateState(newPurseBalance);
      return srcPaymentBalance;
    },
    withdraw: amount => {
      amount = amountMath.coerce(amount);
      signTransferFromUserPeggyAccountToIBCTransferModuleOnPeggy();
      // makePegConnectionHandler.onReceive() does the minting?
      const payment = mint.mintPayment(amount);
      // Commit point
      // Move the withdrawn assets from this purse into a new payment
      // which is returned. Total assets must remain conserved.
      // TODO: when to update balanceUpdater?
      // balanceUpdater.updateState(newPurseBalance);
      return payment;
    },
    // NOTE: this needs to be synchronous, so this actually can't go
    // the peggy chain
    getCurrentAmount: getCurrentBalance,
    getCurrentAmountNotifier: () => balanceNotifier,
    getAllegedBrand: () => brand,
    // eslint-disable-next-line no-use-before-define
    getDepositFacet: () => depositFacet,
  });

  return purse;
};
