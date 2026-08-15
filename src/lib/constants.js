// =============================================================================
// Shared constants — statuses, roles, collection names, labels.
// =============================================================================
// Keeping these in one file means you never have to hunt for a magic string
// like 'in_progress' spelled slightly differently in two places.
// =============================================================================

export const ROLES = {
  CUSTOMER: 'customer',
  EMPLOYEE: 'employee',
  ADMIN: 'admin',
};

/** Firestore collection names. See firestore.rules for who can read each one. */
export const COLLECTIONS = {
  USERS: 'users',
  ADMINS: 'admins',
  EMPLOYEES: 'employees',
  PROPERTIES: 'properties',
  CONSULTATIONS: 'consultations',
  JOBS: 'jobs',
  JOB_PAY: 'jobPay', // employeePay only
  JOB_BILLING: 'jobBilling', // customerPrice + payment status only
  EARNINGS: 'earnings',
};

export const CONSULTATION_STATUS = {
  REQUESTED: 'requested',
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
};

export const CONSULTATION_STATUS_LABELS = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  completed: 'Inspected',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export const JOB_STATUS = {
  REQUESTED: 'requested', // customer asked, admin has not priced it yet
  AVAILABLE: 'available', // employeePay is set, employees can claim it
  ACCEPTED: 'accepted', // an employee claimed it
  IN_PROGRESS: 'in_progress', // employee is mowing right now
  COMPLETED: 'completed', // mowing done
  PAID: 'paid', // customer has paid
  CANCELLED: 'cancelled',
};

export const JOB_STATUS_LABELS = {
  requested: 'Requested',
  available: 'Ready for a mower',
  accepted: 'Scheduled',
  in_progress: 'Mower on site',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

/** Drives the colour of the little status pills. */
export const STATUS_TONES = {
  requested: 'warn',
  scheduled: 'info',
  available: 'info',
  accepted: 'info',
  in_progress: 'info',
  completed: 'good',
  approved: 'good',
  paid: 'good',
  cancelled: 'muted',
  unpaid: 'warn',
};

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PAID: 'paid',
};

export const EARNING_STATUS = {
  OWED: 'owed',
  PAID: 'paid',
};

/**
 * Time-of-day choices for consultation and mow windows. Plain strings keep the
 * MVP simple; they sort correctly because they are zero-padded 24h values.
 */
export const TIME_OPTIONS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00',
];

export const BRAND = {
  name: 'NO MO CO.',
  tagline: 'Student owned • Local • Affordable • Reliable',
  // These are the real contact details. .env can override them per
  // environment, but the site is correct out of the box without it.
  phone: import.meta.env.VITE_CONTACT_PHONE || '(920) 636-3208',
  email: import.meta.env.VITE_CONTACT_EMAIL || 'apolomassingue@gmail.com',
};

/** Flip to true in .env once the Stripe Cloud Function is deployed. */
export const STRIPE_ENABLED = import.meta.env.VITE_STRIPE_ENABLED === 'true';

/**
 * Photo uploads need Cloud Storage, which Firebase now puts behind the paid
 * Blaze plan on new projects. Off by default so the upload boxes do not sit
 * there failing when Storage was never enabled.
 *
 * To turn photos on: enable Storage in the Firebase Console, deploy
 * storage.rules, then set VITE_ENABLE_PHOTOS=true in .env and rebuild.
 * Nothing else needs to change — the upload code is already written.
 */
export const PHOTOS_ENABLED = import.meta.env.VITE_ENABLE_PHOTOS === 'true';
