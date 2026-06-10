/**
 * Firebase configuration.
 * ────────────────────────
 * PASTE YOUR PROJECT'S VALUES BELOW (from Firebase Console →
 * Project settings → Your apps → SDK setup → "Config").
 *
 * These values are NOT secret — Firebase web config is meant to ship in the
 * client. Security comes from Firestore Rules (see firestore.rules), not from
 * hiding these.
 *
 * Until real values are filled in, `isFirebaseConfigured` stays false and the
 * app runs purely on local storage (offline, single-device) exactly as today —
 * so nothing breaks while this is incomplete.
 */

export const firebaseConfig = {
  apiKey:            'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain:        'unico-operations.firebaseapp.com',
  projectId:         'unico-operations',
  storageBucket:     'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId:             '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}

/** True once the placeholders above are replaced with real values. */
export const isFirebaseConfigured =
  !Object.values(firebaseConfig).some(v => typeof v === 'string' && v.startsWith('PASTE_'))
