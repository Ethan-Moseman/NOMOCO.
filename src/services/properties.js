// =============================================================================
// Properties — a customer's lawn: address, permanent notes, photos, price.
// =============================================================================
// customerPrice lives HERE (not on the job) because this collection is
// readable only by the owning customer and admins. Employees are denied.
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
import { COLLECTIONS } from '../lib/constants';

const propertiesRef = collection(db, COLLECTIONS.PROPERTIES);

/** Creates a lawn for a customer. Always unapproved and unpriced at first. */
export async function createProperty(ownerId, data) {
  const payload = {
    ownerId,
    addressLine1: data.addressLine1.trim(),
    city: data.city.trim(),
    state: data.state.trim().toUpperCase(),
    zip: data.zip.trim(),
    permanentNotes: (data.permanentNotes || '').trim(),
    photos: data.photos || [],
    // Only an admin can change these two — see firestore.rules.
    approved: false,
    customerPrice: null,
    createdAt: serverTimestamp(),
  };
  const created = await addDoc(propertiesRef, payload);
  return { id: created.id, ...payload };
}

/** The signed-in customer's properties. MVP assumes one, but returns a list. */
export async function getPropertiesForOwner(ownerId) {
  const snapshot = await getDocs(query(propertiesRef, where('ownerId', '==', ownerId)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProperty(propertyId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.PROPERTIES, propertyId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** Admin only: every property, for the customers list. */
export async function getAllProperties() {
  const snapshot = await getDocs(propertiesRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Customer-safe edit: address, notes and photos only. */
export async function updatePropertyDetails(propertyId, data) {
  await updateDoc(doc(db, COLLECTIONS.PROPERTIES, propertyId), {
    addressLine1: data.addressLine1.trim(),
    city: data.city.trim(),
    state: data.state.trim().toUpperCase(),
    zip: data.zip.trim(),
    permanentNotes: (data.permanentNotes || '').trim(),
    ...(data.photos ? { photos: data.photos } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * ADMIN ONLY — approve the lawn and set what the customer pays per mow.
 * The rules reject this from any non-admin account.
 */
export async function approvePropertyAndSetPrice(propertyId, customerPrice) {
  await updateDoc(doc(db, COLLECTIONS.PROPERTIES, propertyId), {
    approved: true,
    customerPrice: Number(customerPrice),
    approvedAt: serverTimestamp(),
  });
}

/** ADMIN ONLY — change the price later without touching approval. */
export async function setCustomerPrice(propertyId, customerPrice) {
  await updateDoc(doc(db, COLLECTIONS.PROPERTIES, propertyId), {
    customerPrice: Number(customerPrice),
    updatedAt: serverTimestamp(),
  });
}
