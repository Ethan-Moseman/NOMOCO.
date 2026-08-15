# NO MO CO. — Setup, in order

Follow this top to bottom. Budget about 45 minutes for steps 1–6, then you are
testing real workflows.

---

## 1. Create the Firebase project

Go to <https://console.firebase.google.com> → **Add project**.

- Name it `nomoco` (the exact name does not matter).
- Google Analytics: **off** is fine for now, you can add it later.

### Turn on exactly these three services

| Service | Where | What to click |
|---|---|---|
| **Authentication** | Build → Authentication → Get started | Enable the **Email/Password** provider. Leave "Email link" off. |
| **Firestore Database** | Build → Firestore Database → Create database | Choose **Production mode** (we ship our own rules). Pick the region closest to you — `us-central` for Wisconsin. |
| **Storage** | Build → Storage → Get started | Only needed if you want lawn photos. The app works without it. |

You do **not** need the Blaze (paid) plan today. You only need it later if you
deploy the Stripe functions in `/functions`.

### Get your config values

Project settings (⚙ gear) → **General** → scroll to **Your apps** → click the
web icon `</>` → register the app → copy the `firebaseConfig` values.

---

## 2. Point the code at your project

```bash
cd NOMOCO.
cp .env.example .env
```

Open `.env` and paste each value from the Firebase config. Then:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. You should see the NO MO CO. landing page.

> If the browser console says "Firebase is not configured", your `.env` is
> missing or you did not restart `npm run dev` after editing it. Vite only
> reads `.env` at startup.

---

## 3. Publish the security rules

This is the step that actually protects your data. Do not skip it.

```bash
npm install -g firebase-tools     # once, ever
firebase login
firebase use --add                # pick your project, alias it "default"
firebase deploy --only firestore:rules,storage
```

Confirm in the Console under Firestore → Rules that the top of the file says
`NO MO CO. — Firestore Security Rules`.

---

## 4. Make yourself the admin

**This is deliberately a manual step and it is the whole reason nobody can
make themselves an admin.** There is no button for it anywhere in the app.

1. Run the site, click **Create Account**, and sign up with your real email.
2. In the Firebase Console go to **Authentication → Users** and copy your
   **User UID** (a long string like `k3Jd82nQ...`).
3. Go to **Firestore Database → Data → Start collection**.
   - Collection ID: `admins`
   - Document ID: **paste your UID**
   - Add one field: `email` (string) = your email. The field content does not
     matter; what matters is that the document exists.
4. Save, then reload the website. You now have an **Admin** link in the menu.

To add a second admin later, repeat step 3 with their UID. The `admins`
collection is set to `allow write: if false` — not even an admin can write to
it from the app, only you in the Console.

---

## 5. Add an employee

Employees cannot sign themselves up as employees.

1. Have the person create a normal account at `/signup`.
2. You go to **Admin → Employees → All accounts**, find them, and press
   **Approve as employee**.
3. They sign out and back in. They now see the mower dashboard.

Behind the scenes that button creates `employees/{their-uid}` with
`approved: true`. Only an admin can write that collection.

---

## 6. Deploy the website

```bash
firebase deploy
```

Firebase prints a URL like `https://nomoco.web.app`. To use `nomoco.com`
instead: Hosting → Add custom domain, and follow the DNS instructions.

### The QR code

Point every printed QR code at **`https://nomoco.com/go`** (or
`https://nomoco.web.app/go` until the domain is live).

Never print a QR code that points anywhere else. `/go` is a redirect page we
control (`src/pages/Go.jsx`), so you can change where door hangers send people
— forever — by editing one file and redeploying. When you have mobile apps,
flip `SEND_TO_APP_STORES` to `true` in that file and the same printed hangers
start sending iPhone users to the App Store.

---

## 7. The full test — Bob and Jake

This is the test that proves the MVP works. Use two browsers (or one normal
and one private window) so you can be two people at once.

| # | Who | Do this | You should see |
|---|---|---|---|
| 1 | **Bob** | Sign up as `bob@test.com` | Lands on the consultation form |
| 2 | **Bob** | Fill in address `123 Main St`, a date, a time range, and a permanent note like "gate on the left, do not mow the seeded strip" → **REQUEST FREE CONSULTATION** | Dashboard says "Consultation requested" |
| 3 | **You** | Admin → Consultations | Bob's request, with his phone, email and notes |
| 4 | **You** | Type `40` into "Approve property & set price per mow" → **APPROVE** | Consultation flips to Approved |
| 5 | **Bob** | Reload his dashboard | Big green **$40.00** panel and a **REQUEST A MOW** button |
| 6 | **Bob** | REQUEST A MOW → Tuesday, 2:00 PM to 6:00 PM, note "toys in the back yard" | Job appears under Upcoming Services |
| 7 | **You** | Admin → Jobs → "Needs employee pay" | Bob's job, showing customer price $40 |
| 8 | **You** | Type `27` → **MAKE AVAILABLE** | Job moves to "Available to mowers" |
| 9 | **Jake** | Sign up as `jake@test.com`, then you approve him under Admin → Employees | Jake sees the mower dashboard |
| 10 | **Jake** | Available Jobs | `123 Main St · Tue, 2:00 PM – 6:00 PM · YOUR PAY $27.00` and **no $40 anywhere** |
| 11 | **Jake** | VIEW JOB → **ACCEPT JOB** | Moves to My Jobs |
| 12 | **Second mower** (or reload Jake's available list) | — | The job is gone from the available board |
| 13 | **Jake** | START JOB, then MARK COMPLETE | Status shows Completed |
| 14 | **Bob** | Reload dashboard | Past Services shows Completed, **Total $40.00**, payment Due |
| 15 | **You** | Admin → Jobs → Completed | Both numbers: $40 customer, $27 to Jake, $13 profit. Press **Log $27.00 to Jake** |
| 16 | **You** | Admin → Earnings | `Jake — 123 Main St … $27.00 · Amount owed $27.00` |

If all sixteen rows pass, the MVP works.

### Step 10 is the important one — prove it properly

Do not just check that $40 is not on the screen. Check that Jake's browser
cannot *fetch* it:

1. Signed in as Jake, open DevTools → **Network**, and reload the job page.
2. Search the responses for `40`. It is not there, because it was never sent.
3. Now go to DevTools → **Console** and try to fetch it by hand:

```js
// Paste this into the console while signed in as Jake.
const { getFirestore, doc, getDoc } = await import(
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'
);
await getDoc(doc(getFirestore(), 'jobBilling', 'PASTE_THE_JOB_ID_HERE'));
```

It fails with **`FirebaseError: Missing or insufficient permissions`**. That is
the database refusing him, not the interface hiding a number. Try the same
thing as Bob and it returns his $40 — because it is his price.

---

## 8. Optional: turn on card payments

Skip this until the rest works. See the long comment at the top of
`functions/index.js` — it is about 15 minutes and needs the Blaze plan.
Short version:

```bash
cd functions && npm install
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase deploy --only functions
```

Then set `VITE_STRIPE_ENABLED=true` in `.env`, `npm run build`,
`firebase deploy --only hosting`. Apple Pay and Google Pay turn on by
themselves inside Stripe Checkout — there is nothing extra to build.

Until then, the customer sees their total with "please pay your mower
directly", and you press **Mark paid** in the admin Payments tab.

---

## Troubleshooting

**"Missing or insufficient permissions" as an admin.**
Your `admins/{uid}` document does not exist, or the document ID has a typo or a
trailing space. It must be your Auth UID exactly. Sign out and back in after
creating it.

**An employee sees no available jobs.**
Three things must all be true: they have `employees/{uid}` with
`approved: true`; the job status is `available` (you set employee pay); and
they signed out and back in since being approved.

**"The query requires an index."**
You should never see this — every query in this app is a simple `where` and we
sort in JavaScript on purpose. If you add an `orderBy`, click the link in the
error and Firebase builds the index for you.

**Nothing loads and the console mentions `apiKey`.**
`.env` is missing or `npm run dev` was not restarted after you edited it.
