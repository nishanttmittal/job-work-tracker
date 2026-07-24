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

/**
 * Google sign-in must be SAME-ORIGIN as the app, or installed iPhone PWAs can't
 * complete it (iOS blocks reading the auth session across origins → login loops).
 * So when the app is served from a Firebase Hosting domain (*.web.app /
 * *.firebaseapp.com), use THAT hostname as the authDomain — it serves the auth
 * handler first-party. Everywhere else (e.g. the github.io fallback) keep the
 * project default, where Safari's popup path still works.
 */
function resolveAuthDomain() {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname
    if (h.endsWith('.web.app') || h.endsWith('.firebaseapp.com')) return h
  }
  return 'unico-operations.firebaseapp.com'
}

export const firebaseConfig = {
  apiKey:            'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain:        resolveAuthDomain(),
  projectId:         'unico-operations',
  storageBucket:     'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId:             '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}

/** True once the placeholders above are replaced with real values. */
export const isFirebaseConfigured =
  !Object.values(firebaseConfig).some(v => typeof v === 'string' && v.startsWith('PASTE_'))
