# NO MO CO.

Mobile-first lawn-care booking and dispatch. A customer scans a QR code on a
door hanger, requests a free consultation, gets a price, and books mowing
without anyone texting back and forth.

**New here? Read [SETUP.md](./SETUP.md) first** — it takes you from an empty
Firebase project to the full Bob-and-Jake test.

React + Vite on the front, Firebase (Auth, Firestore, Storage, Hosting) on the
back. No server to run, no server to pay for.

---

## The flow the whole app is built around

```
QR code  →  free consultation  →  admin approves + sets customer price
         →  customer requests a mow  →  admin sets employee pay
         →  employee accepts  →  employee completes  →  customer pays
```

---

## The one design decision that matters

**A customer pays $42. The mower earns $27. The mower must never be able to
find out about the $42** — not in the interface, not in the network tab, not
by typing commands into the browser console.

Firebase security rules can hide a whole **document**. They cannot hide a
**field** inside one. So we never put both numbers in the same document. One
mow is three documents that share the same ID:

| Collection | Holds | Who can read it |
|---|---|---|
| `jobs/{id}` | address, date, time window, notes, status, who accepted it — **no money at all** | the customer who owns it · any approved employee while it is available or assigned to them · admin |
| `jobPay/{id}` | `employeePay` | approved employees (available or assigned jobs only) · admin |
| `jobBilling/{id}` | `customerPrice`, `paymentStatus` | the customer who owns it · admin |

An employee asking for `jobBilling` gets `permission-denied` from Firestore
itself. There is no branch of the rule an employee account can satisfy. That
is a database-level guarantee, not a UI trick.

> **If you add a new money field, put it in `jobPay` or `jobBilling`.
> Never in `jobs`.** This is the one rule that keeps the business safe.

---

## Roles

There are three, and only one of them can be self-assigned.

| Role | How you get it | Enforced by |
|---|---|---|
| **customer** | sign up — this is the only thing signup can create | rules force `role == 'customer'` on account creation |
| **employee** | an admin presses "Approve as employee" | a document at `employees/{uid}` with `approved: true`; only admins can write that collection |
| **admin** | you create `admins/{uid}` **by hand in the Firebase Console** | the `admins` collection is `allow write: if false` — no app code can ever create one |

Roles are never read from something the user can edit. `users/{uid}.role` is a
label for the interface; every real permission check asks "does a document
exist at `admins/{uid}` or `employees/{uid}`?" — and the security rules make
the identical check server-side.

**View As Customer / View As Employee** in the admin dashboard switches which
layout you are looking at. You stay signed in as yourself the whole time — it
is not impersonation, no password is shared, and authentication is not
weakened. (You will see empty lists, because you are looking at *your own*
data through a customer's layout.)

---

## Firestore collections

```
users/{uid}              fullName, email, phone, role, createdAt
admins/{uid}             created by hand in the Console. Proof of admin.
employees/{uid}          fullName, email, approved, approvedAt

properties/{id}          ownerId, addressLine1, city, state, zip,
                         permanentNotes, photos[], approved, customerPrice
consultations/{id}       ownerId, propertyId, contact info, preferredDate,
                         preferredTimeStart/End, notes, photos[], status

jobs/{id}                ownerId, propertyId, customerName, address,
                         permanentNotes, temporaryNotes, requestedDate,
                         timeStart, timeEnd, status, assignedEmployeeId,
                         assignedEmployeeName, timestamps      ← NO MONEY
jobPay/{id}              employeePay, setBy, setAt
jobBilling/{id}          ownerId, propertyId, customerPrice,
                         paymentStatus, paidAt

earnings/{jobId}         employeeId, employeeName, jobLabel, amount, status
```

**Statuses.** Consultations: `requested → scheduled → completed → approved`
(plus `cancelled`). Jobs: `requested → available → accepted → in_progress →
completed → paid` (plus `cancelled`).

**Permanent vs temporary notes.** Permanent notes live on the property (gate
latch, pets, do-not-mow strip) and are copied onto every job automatically.
Temporary notes belong to one visit only.

**Prices are locked at request time.** `customerPrice` is copied from the
property onto `jobBilling` when the mow is requested, so raising your prices
next month does not change what someone was already quoted.

---

## Where things live

```
firestore.rules          ← the real security. Read this one.
storage.rules
firebase.json            hosting + rules config
functions/index.js       Stripe (optional — the MVP runs without it)

src/
  lib/
    firebase.js          the only place we connect to Firebase
    constants.js         roles, statuses, collection names, branding
    format.js            money, dates, phone, validation, error messages
  context/AuthContext.jsx who is signed in and what role they are
  components/
    UI.jsx               Button, Card, Field, StatusBadge, Loader, …
    Layout.jsx           nav bar, footer, page shell, View-As banner
    ProtectedRoute.jsx   convenience only — the rules are the security
  services/              ALL database access lives here, one file per area
    users.js properties.js consultations.js jobs.js earnings.js
    photos.js payments.js
  pages/
    Home.jsx Go.jsx HowItWorks.jsx Contact.jsx SignIn.jsx SignUp.jsx
    customer/  Dashboard RequestConsultation RequestMow MyAccount
    employee/  Dashboard JobDetail
    admin/     Dashboard CustomerDetail JobDetail
  App.jsx                every route in one list
  styles.css             one stylesheet, driven by CSS variables
```

**Pages never talk to Firestore directly.** They call a function in
`services/`. When you need to change how data is stored, you change one
service file and every screen follows.

---

## Two employees, one job

When a mower presses ACCEPT, two independent things stop a second mower from
taking the same job:

1. `runTransaction` in `services/jobs.js` re-reads the job at commit time and
   aborts if somebody got there first.
2. The security rule checks `resource.data.status == 'available'` against the
   committed document, so even a hand-crafted request cannot steal a job that
   is already taken.

The loser sees "Sorry — another mower just accepted this job."

---

## Common tasks

**Change the brand colour** — `--green` at the top of `src/styles.css`.

**Change phone / email** — `VITE_CONTACT_PHONE` and `VITE_CONTACT_EMAIL` in
`.env`.

**Change where the QR code sends people** — `src/pages/Go.jsx`. Never reprint
a door hanger.

**Add a field to a job** — add it to the payload in `requestMow()`
(`services/jobs.js`), then display it. If it is a money field, put it in
`jobPay` or `jobBilling` instead.

**Run it** — `npm run dev`. **Ship it** — `npm run deploy`.

---

## Built to become a phone app

Everything the website knows is in Firebase, and every database call goes
through `src/services/`. A React Native or Swift app signs into the same
Firebase project, obeys the same security rules, and reads the same
collections. You would rewrite the screens, not the backend — and the money
separation keeps working, because it is enforced in the database rather than
in this codebase.

---

## Deliberately left for later

These were skipped so the core flow could ship today, and the data model
already leaves room for each one:

- **Recurring mowing** (weekly / 10 days / 2 weeks) — add a `schedule` field to
  the property and a scheduled Cloud Function that creates jobs.
- **Push notifications and reminders** ("your lawn is complete", "it has been 7
  days") — Firebase Cloud Messaging plus a scheduled function.
- **Route optimisation and richer maps** — the "Open in Maps" links work now;
  ordering a day's stops needs a distance API.
- **Before/after photos** — completion photos already work; before-photos are
  the same code path.
- **Referral discounts, weather rescheduling, analytics dashboards** — the
  admin dashboard already computes revenue, labour and gross margin from
  `jobBilling` and `jobPay`; the rest is more of the same maths.
- **Automatic employee payouts** — v1 tracks what is owed and you pay it
  yourself, on purpose. Stripe Connect is the eventual upgrade.

Known simplifications, all safe and all easy to revisit:

- One property per customer. The data model already supports several
  (`properties` is keyed by `ownerId`), the interface just shows the first.
- Lists sort in JavaScript instead of using `orderBy`, so the app needs **zero
  composite indexes**. Revisit at a few thousand rows.
- Storage rules let any signed-in user read photos (mowers genuinely need to
  see the property). No financial data is ever in Storage.
- Employees can see the full address of a job before accepting it, which is
  normal for this business. Masking it until acceptance is a rules change plus
  a second document, the same pattern as the money split.
