// =============================================================================
// Firebase setup — the single place the app connects to Firebase.
// =============================================================================
// Every other file imports { auth, db, storage } from here. If you ever change
// projects, you change the .env file and nothing else.
// =============================================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// A friendly warning instead of a cryptic crash when .env is missing.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

if (!isFirebaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'NO MO CO.: Firebase is not configured. Copy .env.example to .env and ' +
      'paste your Firebase web config values, then restart `npm run dev`.'
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
