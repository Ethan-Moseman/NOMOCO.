// =============================================================================
// Users + the employee roster.
// =============================================================================
// Reminder on how roles actually work:
//   - users/{uid}.role is a LABEL for the UI.
//   - The real permission check is "does a document exist at admins/{uid} or
//     employees/{uid} with approved: true?" — see firestore.rules.
// Making someone an employee therefore means creating their employees/{uid}
// document, which only an admin can do.
// =============================================================================

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, ROLES } from '../lib/constants';

export async function getUser(uid) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** Anyone may update their own name / phone. Rules block role changes. */
export async function updateOwnProfile(uid, { fullName, phone }) {
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
    fullName: fullName.trim(),
    phone: phone.trim(),
    updatedAt: serverTimestamp(),
  });
}

/** ADMIN ONLY — everyone who has an account. */
export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.USERS));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ADMIN ONLY — the employee roster (documents in /employees). */
export async function getAllEmployees() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.EMPLOYEES));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * ADMIN ONLY — promote an existing account to employee.
 *
 * The person must sign up normally first (which makes them a customer), then
 * you approve them here. That is the whole "employees must be invited or
 * approved" requirement: there is no way to get this document without an admin.
 */
export async function approveEmployee(uid, { fullName, email }) {
  await setDoc(
    doc(db, COLLECTIONS.EMPLOYEES, uid),
    {
      uid,
      fullName,
      email,
      approved: true,
      approvedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Keep the users/{uid} label in sync so the UI reads nicely.
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), { role: ROLES.EMPLOYEE });
}

/** ADMIN ONLY — turn off an employee's access without deleting their account. */
export async function suspendEmployee(uid) {
  await updateDoc(doc(db, COLLECTIONS.EMPLOYEES, uid), { approved: false });
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), { role: ROLES.CUSTOMER });
}

/** ADMIN ONLY — remove someone from the roster entirely. */
export async function removeEmployee(uid) {
  await deleteDoc(doc(db, COLLECTIONS.EMPLOYEES, uid));
  await updateDoc(doc(db, COLLECTIONS.USERS, uid), { role: ROLES.CUSTOMER });
}
