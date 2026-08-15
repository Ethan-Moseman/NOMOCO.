// =============================================================================
// Jobs — one mow. THE MONEY RULES LIVE HERE, SO READ THIS BEFORE EDITING.
// =============================================================================
// A single mow is stored across THREE documents that all share the same id:
//
//   jobs/{jobId}        operational only. Address, date, window, notes,
//                       status, who accepted it. *** NEVER PUT MONEY HERE ***
//   jobPay/{jobId}      { employeePay }      readable by employees + admin
//   jobBilling/{jobId}  { customerPrice,     readable by the owning customer
//                         paymentStatus }    + admin. Employees are DENIED.
//
// Why three documents? Firestore security rules can hide a document but cannot
// hide a field. If employeePay and customerPrice sat in one document, then any
// employee who could read their pay could open the browser network tab and
// read the customer's price too. Splitting them means the database itself
// refuses the request.
//
// If you add a new money field, put it in jobPay or jobBilling — never in jobs.
// =============================================================================

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, JOB_STATUS, PAYMENT_STATUS } from '../lib/constants';

const jobsRef = collection(db, COLLECTIONS.JOBS);

// -----------------------------------------------------------------------------
// CUSTOMER
// -----------------------------------------------------------------------------

/**
 * A customer requests a mow. Creates the operational job AND the private
 * billing document holding their price. No employee pay exists yet — the admin
 * sets that next, which is what makes the job available.
 */
export async function requestMow({ owner, property, request }) {
  const payload = {
    ownerId: owner.uid,
    propertyId: property.id,
    // Copied onto the job so employees get what they need without being able
    // to read the customer's profile or property document.
    customerName: owner.fullName,
    address: request.address,
    permanentNotes: property.permanentNotes || '',
    temporaryNotes: (request.temporaryNotes || '').trim(),
    requestedDate: request.requestedDate,
    timeStart: request.timeStart,
    timeEnd: request.timeEnd,
    status: JOB_STATUS.REQUESTED, // rules require exactly this on create
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    createdAt: serverTimestamp(),
    startedAt: null,
    completedAt: null,
    completionPhotoUrl: null,
  };

  // We make the id ourselves so the job and its billing record share one id
  // and can be written in a single batch. Either both land or neither does —
  // there is never a job without a price attached to it.
  const jobRef = doc(jobsRef);
  const batch = writeBatch(db);

  batch.set(jobRef, payload);

  // Private billing document.
  //
  // The price is COPIED here at request time, which locks it in. If you raise
  // the customer's price next month, mows already requested keep the price
  // they were quoted. The rules check this number matches the one on their
  // property, so a customer cannot request a $42 mow and bill themselves $1.
  batch.set(doc(db, COLLECTIONS.JOB_BILLING, jobRef.id), {
    jobId: jobRef.id,
    ownerId: owner.uid,
    propertyId: property.id,
    customerPrice: property.customerPrice ?? null,
    paymentStatus: PAYMENT_STATUS.UNPAID,
    paidAt: null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return { id: jobRef.id, ...payload };
}

/** Every job for one customer (their dashboard). */
export async function getJobsForOwner(ownerId) {
  const snapshot = await getDocs(query(jobsRef, where('ownerId', '==', ownerId)));
  return sortByDate(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** The customer's own price + payment status for one job. */
export async function getBilling(jobId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.JOB_BILLING, jobId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** Billing rows for one customer, keyed by job id for easy lookup. */
export async function getBillingForOwner(ownerId) {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIONS.JOB_BILLING), where('ownerId', '==', ownerId))
  );
  const byJobId = {};
  snapshot.docs.forEach((d) => {
    byJobId[d.id] = { id: d.id, ...d.data() };
  });
  return byJobId;
}

export async function cancelJob(jobId) {
  await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
    status: JOB_STATUS.CANCELLED,
    cancelledAt: serverTimestamp(),
  });
}

// -----------------------------------------------------------------------------
// EMPLOYEE
// -----------------------------------------------------------------------------

/**
 * Jobs any approved employee may claim. The where() clause matches the
 * security rule exactly — that is what makes the query legal.
 */
export async function getAvailableJobs() {
  const snapshot = await getDocs(
    query(jobsRef, where('status', '==', JOB_STATUS.AVAILABLE))
  );
  return sortByDate(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/** Jobs this employee already accepted. */
export async function getJobsForEmployee(employeeId) {
  const snapshot = await getDocs(
    query(jobsRef, where('assignedEmployeeId', '==', employeeId))
  );
  return sortByDate(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

/**
 * How much THIS employee earns for one job. Read one document at a time by id
 * — the rule checks the matching job is available or assigned to them.
 * There is no query here that could ever return customerPrice.
 */
export async function getEmployeePay(jobId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.JOB_PAY, jobId));
  return snapshot.exists() ? Number(snapshot.data().employeePay) : null;
}

/** Attaches employeePay to a list of jobs for display. */
export async function attachPay(jobList) {
  const pays = await Promise.all(
    jobList.map((job) => getEmployeePay(job.id).catch(() => null))
  );
  return jobList.map((job, index) => ({ ...job, employeePay: pays[index] }));
}

/**
 * ACCEPT A JOB — the race-condition-safe part.
 *
 * Two protections, both required:
 *   1. runTransaction re-reads the job at commit time and aborts if another
 *      employee got there first.
 *   2. firestore.rules independently checks status == 'available' against the
 *      committed document, so even a hand-crafted request cannot steal a job
 *      that someone else already accepted.
 *
 * Throws a plain Error with a readable message when the job is already gone.
 */
export async function acceptJob(jobId, employee) {
  const jobRef = doc(db, COLLECTIONS.JOBS, jobId);

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists()) {
      throw new Error('This job no longer exists.');
    }
    const data = snapshot.data();
    if (data.status !== JOB_STATUS.AVAILABLE || data.assignedEmployeeId) {
      throw new Error('Sorry — another mower just accepted this job.');
    }

    transaction.update(jobRef, {
      status: JOB_STATUS.ACCEPTED,
      assignedEmployeeId: employee.uid,
      assignedEmployeeName: employee.fullName,
      acceptedAt: serverTimestamp(),
    });
  });
}

export async function startJob(jobId) {
  await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
    status: JOB_STATUS.IN_PROGRESS,
    startedAt: serverTimestamp(),
  });
}

export async function completeJob(jobId, completionPhotoUrl = null) {
  await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
    status: JOB_STATUS.COMPLETED,
    completedAt: serverTimestamp(),
    completionPhotoUrl,
  });
}

// -----------------------------------------------------------------------------
// ADMIN
// -----------------------------------------------------------------------------

export async function getAllJobs() {
  const snapshot = await getDocs(jobsRef);
  return sortByDate(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
}

export async function getJob(jobId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.JOBS, jobId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** ADMIN ONLY — every pay row at once, keyed by job id. */
export async function getAllPay() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.JOB_PAY));
  const byJobId = {};
  snapshot.docs.forEach((d) => {
    byJobId[d.id] = Number(d.data().employeePay);
  });
  return byJobId;
}

/** ADMIN ONLY — every billing row at once, keyed by job id. */
export async function getAllBilling() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.JOB_BILLING));
  const byJobId = {};
  snapshot.docs.forEach((d) => {
    byJobId[d.id] = { id: d.id, ...d.data() };
  });
  return byJobId;
}

/**
 * ADMIN ONLY — set what the mower earns and release the job to employees.
 * Writing the pay document and flipping the status happen in one batch so a
 * job can never be available with no pay attached to it.
 */
export async function setEmployeePayAndPublish(jobId, employeePay, adminUid) {
  const batch = writeBatch(db);

  batch.set(doc(db, COLLECTIONS.JOB_PAY, jobId), {
    jobId,
    employeePay: Number(employeePay),
    setBy: adminUid,
    setAt: serverTimestamp(),
  });

  batch.update(doc(db, COLLECTIONS.JOBS, jobId), {
    status: JOB_STATUS.AVAILABLE,
    publishedAt: serverTimestamp(),
  });

  await batch.commit();
}

/** ADMIN ONLY — change pay on a job that is already out there. */
export async function updateEmployeePay(jobId, employeePay, adminUid) {
  await setDoc(
    doc(db, COLLECTIONS.JOB_PAY, jobId),
    {
      jobId,
      employeePay: Number(employeePay),
      setBy: adminUid,
      setAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** ADMIN ONLY — change what this one mow costs the customer. */
export async function updateCustomerPrice(jobId, customerPrice) {
  await setDoc(
    doc(db, COLLECTIONS.JOB_BILLING, jobId),
    { customerPrice: Number(customerPrice), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** ADMIN ONLY — force a status (hand off, cancel, re-open, mark paid). */
export async function adminSetJobStatus(jobId, status) {
  await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** ADMIN ONLY — hand a job directly to a mower without them claiming it. */
export async function adminAssignEmployee(jobId, employee) {
  await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
    assignedEmployeeId: employee ? employee.id : null,
    assignedEmployeeName: employee ? employee.fullName : null,
    status: employee ? JOB_STATUS.ACCEPTED : JOB_STATUS.AVAILABLE,
    updatedAt: serverTimestamp(),
  });
}

/** ADMIN ONLY — edit the schedule or the notes on a job. */
export async function adminUpdateJob(jobId, fields) {
  await updateDoc(doc(db, COLLECTIONS.JOBS, jobId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

/** ADMIN ONLY — record that the customer paid (cash, Venmo, or Stripe). */
export async function markJobPaid(jobId) {
  const batch = writeBatch(db);
  batch.set(
    doc(db, COLLECTIONS.JOB_BILLING, jobId),
    { paymentStatus: PAYMENT_STATUS.PAID, paidAt: serverTimestamp() },
    { merge: true }
  );
  batch.update(doc(db, COLLECTIONS.JOBS, jobId), { status: JOB_STATUS.PAID });
  await batch.commit();
}

/** ADMIN ONLY — delete a job and both of its money documents together. */
export async function deleteJobCompletely(jobId) {
  await Promise.all([
    deleteDoc(doc(db, COLLECTIONS.JOBS, jobId)),
    deleteDoc(doc(db, COLLECTIONS.JOB_PAY, jobId)).catch(() => {}),
    deleteDoc(doc(db, COLLECTIONS.JOB_BILLING, jobId)).catch(() => {}),
  ]);
}

/** Newest requested date first. */
function sortByDate(rows) {
  return rows.sort((a, b) =>
    String(b.requestedDate || '').localeCompare(String(a.requestedDate || ''))
  );
}
