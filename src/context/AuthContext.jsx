// =============================================================================
// AuthContext — who is signed in, and what are they allowed to do?
// =============================================================================
// The app asks this context three questions:
//   user      -> the Firebase Auth user (or null)
//   profile   -> their users/{uid} document (name, phone, email)
//   role      -> 'admin' | 'employee' | 'customer'
//
// HOW THE ROLE IS DECIDED — this is the important part:
//   admin    if a document exists at admins/{uid}
//   employee if a document exists at employees/{uid} with approved === true
//   customer otherwise
//
// The role is NOT read from a field the user can edit. Security rules make the
// exact same checks server-side, so even if someone hacked this file in their
// browser they would still be denied by the database.
// =============================================================================

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { COLLECTIONS, ROLES } from '../lib/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(ROLES.CUSTOMER);
  const [loading, setLoading] = useState(true);

  // Admin-only "View As" preview. This changes NOTHING about permissions — it
  // only changes which dashboard an admin is looking at. See ViewAsBanner.
  const [previewRole, setPreviewRole] = useState(null);

  /** Works out the role and returns it, so callers can redirect immediately. */
  async function loadRoleAndProfile(firebaseUser) {
    if (!firebaseUser) {
      setProfile(null);
      setRole(ROLES.CUSTOMER);
      return ROLES.CUSTOMER;
    }
    const uid = firebaseUser.uid;

    // These three reads are allowed by the rules for your own uid.
    const [profileSnap, adminSnap, employeeSnap] = await Promise.all([
      getDoc(doc(db, COLLECTIONS.USERS, uid)),
      getDoc(doc(db, COLLECTIONS.ADMINS, uid)),
      getDoc(doc(db, COLLECTIONS.EMPLOYEES, uid)),
    ]);

    setProfile(profileSnap.exists() ? { id: uid, ...profileSnap.data() } : null);

    let resolved = ROLES.CUSTOMER;
    if (adminSnap.exists()) {
      resolved = ROLES.ADMIN;
    } else if (employeeSnap.exists() && employeeSnap.data().approved === true) {
      resolved = ROLES.EMPLOYEE;
    }
    setRole(resolved);
    return resolved;
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        await loadRoleAndProfile(firebaseUser);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Could not load your account details:', error);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  /**
   * Creates a customer account. Note that role is hard-coded to 'customer'
   * here AND enforced in firestore.rules — signup can never produce an admin
   * or an employee.
   */
  async function signUp({ fullName, email, phone, password }) {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    const uid = credential.user.uid;

    await updateProfile(credential.user, { displayName: fullName.trim() });

    await setDoc(doc(db, COLLECTIONS.USERS, uid), {
      uid,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: ROLES.CUSTOMER,
      createdAt: serverTimestamp(),
    });

    await loadRoleAndProfile(credential.user);
    return credential.user;
  }

  /** Returns the signed-in user's role so the caller can redirect right away. */
  async function signIn(email, password) {
    const credential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );
    return loadRoleAndProfile(credential.user);
  }

  async function logOut() {
    setPreviewRole(null);
    await signOut(auth);
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email.trim());
  }

  async function refreshProfile() {
    if (auth.currentUser) await loadRoleAndProfile(auth.currentUser);
  }

  const value = useMemo(
    () => ({
      user,
      profile,
      role,
      loading,
      isAdmin: role === ROLES.ADMIN,
      isEmployee: role === ROLES.EMPLOYEE,
      isCustomer: role === ROLES.CUSTOMER,
      // What the UI should render. Only an admin can ever set previewRole.
      effectiveRole: role === ROLES.ADMIN && previewRole ? previewRole : role,
      previewRole,
      setPreviewRole: role === ROLES.ADMIN ? setPreviewRole : () => {},
      signUp,
      signIn,
      logOut,
      resetPassword,
      refreshProfile,
    }),
    [user, profile, role, loading, previewRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
