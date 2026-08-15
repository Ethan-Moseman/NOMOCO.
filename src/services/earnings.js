// =============================================================================
// Employee earnings — what we owe each mower.
// =============================================================================
// Version 1 does NOT pay employees automatically. We record what is owed so
// the admin can see "Jake: $27 + $25 + $31 = $83 owed" and pay it separately.
//
// The earning document id IS the job id, so clicking "record earning" twice on
// the same job can never create a duplicate line.
// =============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, EARNING_STATUS } from '../lib/constants';

const earningsRef = collection(db, COLLECTIONS.EARNINGS);

/** ADMIN ONLY — log what a completed job earned its mower. */
export async function recordEarning({ jobId, employeeId, employeeName, amount, jobLabel }) {
  await setDoc(doc(db, COLLECTIONS.EARNINGS, jobId), {
    jobId,
    employeeId,
    employeeName,
    jobLabel, // e.g. "123 Main St — Aug 18"
    amount: Number(amount),
    status: EARNING_STATUS.OWED,
    createdAt: serverTimestamp(),
  });
}

export async function getEarning(jobId) {
  const snapshot = await getDoc(doc(db, COLLECTIONS.EARNINGS, jobId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

/** ADMIN ONLY — every earning line. */
export async function getAllEarnings() {
  const snapshot = await getDocs(earningsRef);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** An employee looking at their own earnings. Rules allow only their own. */
export async function getEarningsForEmployee(employeeId) {
  const snapshot = await getDocs(
    query(earningsRef, where('employeeId', '==', employeeId))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ADMIN ONLY — mark that you handed the mower their money. */
export async function markEarningPaid(earningId) {
  await updateDoc(doc(db, COLLECTIONS.EARNINGS, earningId), {
    status: EARNING_STATUS.PAID,
    paidAt: serverTimestamp(),
  });
}

/** Groups lines per employee and totals what is still owed. */
export function summarizeByEmployee(earnings) {
  const byEmployee = {};
  earnings.forEach((earning) => {
    const key = earning.employeeId;
    if (!byEmployee[key]) {
      byEmployee[key] = {
        employeeId: key,
        employeeName: earning.employeeName || 'Unknown',
        lines: [],
        owed: 0,
        paid: 0,
      };
    }
    byEmployee[key].lines.push(earning);
    if (earning.status === EARNING_STATUS.PAID) {
      byEmployee[key].paid += Number(earning.amount || 0);
    } else {
      byEmployee[key].owed += Number(earning.amount || 0);
    }
  });
  return Object.values(byEmployee);
}
