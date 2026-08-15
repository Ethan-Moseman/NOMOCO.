// =============================================================================
// Small formatting + validation helpers used across the app.
// =============================================================================

/** 42 -> "$42.00" ; 42.5 -> "$42.50" ; null -> "—" */
export function money(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '—';
  }
  return `$${Number(amount).toFixed(2)}`;
}

/** "2026-08-18" -> "Tue, Aug 18" (dates are stored as plain YYYY-MM-DD strings) */
export function prettyDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "14:00" -> "2:00 PM" */
export function prettyTime(hhmm) {
  if (!hhmm) return '—';
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

/** "14:00","18:00" -> "2:00 PM – 6:00 PM" */
export function prettyWindow(start, end) {
  if (!start && !end) return 'Any time';
  return `${prettyTime(start)} – ${prettyTime(end)}`;
}

/** Firestore Timestamp | Date | null -> "Aug 15, 3:42 PM" */
export function prettyStamp(ts) {
  if (!ts) return '—';
  const date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Today as YYYY-MM-DD in the user's own timezone (for date input mins). */
export function todayISO() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/** "1234567890" -> "(123) 456-7890" as the user types. */
export function formatPhoneInput(value) {
  const digits = String(value).replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export function isValidPhone(value) {
  return String(value).replace(/\D/g, '').length === 10;
}

/**
 * Turns a Firebase error into something a customer can actually read.
 * Firebase codes look like "auth/email-already-in-use".
 */
export function friendlyError(error) {
  const code = error?.code || '';
  const map = {
    'auth/email-already-in-use': 'That email already has an account. Try signing in instead.',
    'auth/invalid-email': 'That email address does not look right.',
    'auth/weak-password': 'Please choose a password with at least 6 characters.',
    'auth/user-not-found': 'We could not find an account with that email.',
    'auth/wrong-password': 'That password is not correct.',
    'auth/invalid-credential': 'That email or password is not correct.',
    'auth/too-many-requests': 'Too many attempts. Please wait a minute and try again.',
    'auth/network-request-failed': 'Network problem. Check your connection and try again.',
    'permission-denied': 'You do not have permission to do that.',
    'unavailable': 'Cannot reach the server right now. Please try again.',
  };
  if (map[code]) return map[code];
  return error?.message || 'Something went wrong. Please try again.';
}

/** Builds a maps link that opens Apple Maps on iOS and Google Maps elsewhere. */
export function mapsUrl(address) {
  return `https://maps.google.com/?q=${encodeURIComponent(address || '')}`;
}

/** Joins address parts into one line, skipping blanks. */
export function fullAddress(property) {
  if (!property) return '';
  return [property.addressLine1, property.city, property.state, property.zip]
    .filter(Boolean)
    .join(', ');
}
