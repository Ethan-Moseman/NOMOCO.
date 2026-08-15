// =============================================================================
// Payments — Stripe Checkout.
// =============================================================================
// We never touch card numbers. The customer is sent to a Stripe-hosted page,
// which gives us Apple Pay, Google Pay, credit and debit for free.
//
// Creating a Checkout Session requires a SECRET key, which can never live in
// a browser. So it lives in the Cloud Function in /functions/index.js.
//
// TODAY: leave VITE_STRIPE_ENABLED=false. The customer sees "Total $42" and a
// note to pay their mower directly, and the admin marks it paid by hand.
// LATER: deploy the function, set VITE_STRIPE_ENABLED=true, and the same
// PAY NOW button starts working with no other code changes.
// =============================================================================

import app from '../lib/firebase';
import { STRIPE_ENABLED } from '../lib/constants';

export { STRIPE_ENABLED };

/**
 * Sends the customer to Stripe Checkout for one job.
 * The function looks the price up from jobBilling on the server — the browser
 * never gets to say what the amount is, so nobody can pay $1 for a $42 mow.
 */
export async function startCheckout(jobId) {
  if (!STRIPE_ENABLED) {
    throw new Error(
      'Online payment is not switched on yet. Please pay your mower directly.'
    );
  }
  // Loaded on demand so the Functions SDK stays out of the main bundle —
  // most visitors never press PAY NOW.
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app);
  const createCheckout = httpsCallable(functions, 'createStripeCheckout');
  const response = await createCheckout({ jobId });
  const url = response?.data?.url;
  if (!url) throw new Error('Could not start checkout. Please try again.');
  window.location.assign(url);
}
