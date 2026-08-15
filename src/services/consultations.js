// =============================================================================
// Consultations — the free lawn visit a new customer requests from the QR code.
// =============================================================================
// Flow: requested -> scheduled -> completed (we looked at it) -> approved
// Approving happens together with setting the customer's price per mow.
// =============================================================================

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, CONSULTATION_STATUS } from '../lib/constants';

const consultationsRef = collection(db, COLLECTIONS.CONSULTATIONS);

export async function createConsultation(ownerId, data) {
  const payload = {
    ownerId,
    propertyId: data.propertyId,
    fullName: data.fullName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    address: data.address,
    preferredDate: data.preferredDate,
    preferredTimeStart: data.preferredTimeStart,
    preferredTimeEnd: data.preferredTimeEnd,
    notes: (data.notes || '').trim(),
    photos: data.photos || [],
    status: CONSULTATION_STATUS.REQUESTED, // rules require exactly this
    createdAt: serverTimestamp(),
  };
  const created = await addDoc(consultationsRef, payload);
  return { id: created.id, ...payload };
}

export async function getConsultationsForOwner(ownerId) {
  const snapshot = await getDocs(
    query(consultationsRef, where('ownerId', '==', ownerId))
  );
  return sortNewestFirst(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** ADMIN ONLY — every consultation for the admin dashboard. */
export async function getAllConsultations() {
  const snapshot = await getDocs(consultationsRef);
  return sortNewestFirst(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export async function getConsultation(consultationId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.CONSULTATIONS, consultationId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** ADMIN ONLY — move a consultation along its status track. */
export async function setConsultationStatus(consultationId, status, extra = {}) {
  await updateDoc(doc(db, COLLECTIONS.CONSULTATIONS, consultationId), {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
  });
}

/** The customer backing out of their own request. */
export async function cancelConsultation(consultationId) {
  await updateDoc(doc(db, COLLECTIONS.CONSULTATIONS, consultationId), {
    status: CONSULTATION_STATUS.CANCELLED,
    updatedAt: serverTimestamp(),
  });
}

/**
 * We sort in JavaScript rather than with Firestore's orderBy so that the app
 * needs zero composite indexes. At our data size this is faster to ship and
 * costs nothing. If you ever have thousands of rows, add orderBy + an index.
 */
function sortNewestFirst(rows) {
  return rows.sort(
    (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
  );
}
