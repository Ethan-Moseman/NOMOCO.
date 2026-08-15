/* =============================================================================
 * NO MO CO. — Stripe Cloud Functions (OPTIONAL — deploy when you are ready)
 * =============================================================================
 * YOU DO NOT NEED THIS TO RUN THE MVP. Leave VITE_STRIPE_ENABLED=false and the
 * website works fine — the customer sees their total and the admin marks jobs
 * paid by hand.
 *
 * WHY THIS EXISTS AT ALL: creating a Stripe Checkout Session needs your SECRET
 * key. A secret key in a browser is a secret key on the internet. So the
 * secret stays here, on the server, and the browser only ever asks "start
 * checkout for job X".
 *
 * TWO THINGS THAT MAKE THIS SAFE:
 *   1. The amount comes from jobBilling in Firestore, never from the browser.
 *      A customer cannot ask to pay $1 for a $42 mow.
 *   2. Payment is confirmed by Stripe's webhook, not by the customer's browser
 *      landing on a success page. A closed laptop cannot fake a payment.
 *
 * TO DEPLOY (about 15 minutes, and it requires the Blaze plan):
 *   1. Upgrade the Firebase project to Blaze (pay-as-you-go). Free tier limits
 *      still apply; a project this size normally costs pennies.
 *   2. cd functions && npm install
 *   3. firebase functions:secrets:set STRIPE_SECRET_KEY
 *      firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 *   4. firebase deploy --only functions
 *   5. In the Stripe Dashboard add a webhook pointing at the deployed
 *      stripeWebhook URL, listening for checkout.session.completed.
 *   6. Put VITE_STRIPE_ENABLED=true in .env, rebuild, redeploy hosting.
 *
 * Apple Pay and Google Pay turn on automatically in Stripe Checkout on
 * supported devices — there is nothing extra to build. Venmo can be added
 * later in the Stripe Dashboard's payment method settings.
 * ========================================================================== */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

admin.initializeApp();
const db = admin.firestore();

/** Change this to your live site once you have a domain. */
const SITE_URL = process.env.SITE_URL || 'https://nomoco.com';

/* ---------------------------------------------------------------------------
 * createStripeCheckout — called from the customer's PAY NOW button.
 * ------------------------------------------------------------------------ */
exports.createStripeCheckout = onCall(
  { secrets: [STRIPE_SECRET_KEY], region: 'us-central1' },
  async (request) => {
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());

    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Please sign in first.');
    }

    const jobId = request.data?.jobId;
    if (!jobId) {
      throw new HttpsError('invalid-argument', 'A job id is required.');
    }

    // Read the price from OUR database, not from the browser.
    const billingSnap = await db.collection('jobBilling').doc(jobId).get();
    if (!billingSnap.exists) {
      throw new HttpsError('not-found', 'No billing record for that job.');
    }
    const billing = billingSnap.data();

    // Only the customer who owns the job may pay for it.
    if (billing.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'That is not your job.');
    }
    if (billing.paymentStatus === 'paid') {
      throw new HttpsError('failed-precondition', 'That job is already paid.');
    }

    const amount = Number(billing.customerPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HttpsError('failed-precondition', 'That job has no price set.');
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Card covers Apple Pay and Google Pay in Stripe Checkout automatically.
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100), // Stripe works in cents
            product_data: { name: 'NO MO CO. lawn mowing' },
          },
        },
      ],
      // The webhook trusts this, so keep it accurate.
      metadata: { jobId, ownerId: uid },
      success_url: `${SITE_URL}/dashboard?paid=1`,
      cancel_url: `${SITE_URL}/dashboard`,
    });

    return { url: session.url };
  }
);

/* ---------------------------------------------------------------------------
 * stripeWebhook — Stripe tells US when money actually moved.
 * ------------------------------------------------------------------------ */
exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET], region: 'us-central1' },
  async (request, response) => {
    const stripe = require('stripe')(STRIPE_SECRET_KEY.value());

    let event;
    try {
      // Verifies the request really came from Stripe.
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        request.headers['stripe-signature'],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (error) {
      console.error('Stripe signature check failed:', error.message);
      return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const jobId = session.metadata?.jobId;

      if (jobId) {
        const batch = db.batch();
        batch.set(
          db.collection('jobBilling').doc(jobId),
          {
            paymentStatus: 'paid',
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent || null,
          },
          { merge: true }
        );
        batch.update(db.collection('jobs').doc(jobId), { status: 'paid' });
        await batch.commit();
      }
    }

    response.json({ received: true });
  }
);
