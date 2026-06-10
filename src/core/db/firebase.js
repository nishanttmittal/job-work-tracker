/**
 * Firebase service — initialises the app, Firestore (with offline persistence)
 * and Auth. This is the low-level cloud gateway; the sync engine and auth hook
 * build on it. Safe to import even when not configured (guards inside).
 *
 * Data layout in Firestore (all under one app namespace so the project can
 * host other apps too):
 *   apps/platingjobwork/challans/{id}     ← one doc per challan (concurrent-safe)
 *   apps/platingjobwork/logs/{id}         ← one doc per audit log line
 *   apps/platingjobwork/meta/parties      ← { list:[...] }
 *   apps/platingjobwork/meta/products     ← { list:[...] }
 *   apps/platingjobwork/meta/counter      ← { value:N }  (atomic challan numbers)
 */
import { initializeApp, getApp } from 'firebase/app'
import {
  initializeFirestore,
  collection, doc, getDoc, runTransaction,
} from 'firebase/firestore'
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth'
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig'

const APP_NS = 'platingjobwork'

let app = null
let db = null
let auth = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  // Offline-first: IndexedDB cache, shared across tabs. Reads/writes work with
  // no network and sync automatically when back online (requirement: offline).
  // In-memory cache + auto long-polling. Firestore's IndexedDB persistence
  // hangs on Safari/iOS in some environments, so we use the reliable memory
  // cache (data still loads instantly online; the app needs a connection to
  // create challans anyway, for server-issued unique numbers). Long-polling
  // auto-detect makes the connection work on Safari and restrictive networks.
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  })
  auth = getAuth(app)
}

export { app, db, auth, isFirebaseConfigured, APP_NS }

/** Path helpers for the app's Firestore documents/collections. */
export const paths = {
  challans: () => collection(db, 'apps', APP_NS, 'challans'),
  challan: (id) => doc(db, 'apps', APP_NS, 'challans', id),
  logs: () => collection(db, 'apps', APP_NS, 'logs'),
  logDoc: (id) => doc(db, 'apps', APP_NS, 'logs', id),
  parties: () => doc(db, 'apps', APP_NS, 'meta', 'parties'),
  products: () => doc(db, 'apps', APP_NS, 'meta', 'products'),
  counter: () => doc(db, 'apps', APP_NS, 'meta', 'counter'),
  matchlinks: () => doc(db, 'apps', APP_NS, 'meta', 'matchlinks'),
  users: () => collection(db, 'apps', APP_NS, 'users'),
  user: (id) => doc(db, 'apps', APP_NS, 'users', id),
  incoming: () => collection(db, 'apps', APP_NS, 'incoming'),
  incomingDoc: (id) => doc(db, 'apps', APP_NS, 'incoming', id),
}

/** Ensure there is a signed-in user (anonymous by default). Resolves to uid. */
export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    if (!auth) return reject(new Error('Firebase not configured'))
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user.uid) }
    })
    signInAnonymously(auth).catch(reject)
  })
}

/**
 * Atomically reserve the next challan number from the shared counter doc.
 * A Firestore transaction guarantees no two devices ever get the same number
 * (this is what eliminates cross-device duplicate challan numbers).
 * @returns {Promise<number>} the reserved counter value
 */
export async function reserveChallanNumber() {
  return runTransaction(db, async (tx) => {
    const ref = paths.counter()
    const snap = await tx.get(ref)
    const current = snap.exists() ? (snap.data().value || 0) : 0
    const next = current + 1
    tx.set(ref, { value: next }, { merge: true })
    return next
  })
}

/**
 * Atomically reserve a BLOCK of `n` numbers (for bulk import). Returns the
 * first number of the block; callers use first … first+n-1.
 */
export async function reserveChallanBlock(n) {
  return runTransaction(db, async (tx) => {
    const ref = paths.counter()
    const snap = await tx.get(ref)
    const current = snap.exists() ? (snap.data().value || 0) : 0
    tx.set(ref, { value: current + n }, { merge: true })
    return current + 1
  })
}

/** One-time read of the counter (for seeding/preview). */
export async function readCounter() {
  if (!db) return 0
  const snap = await getDoc(paths.counter())
  return snap.exists() ? (snap.data().value || 0) : 0
}

/**
 * Sign the MAIN session in with Google (Manager/Admin) so Firestore rules can
 * see the email and roles resolve. Falls back to redirect if popup is blocked
 * (common on iPhone Safari).
 */
export async function signInWithGoogle() {
  if (!auth) throw new Error('Cloud not configured')
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    return await signInWithPopup(auth, provider)
  } catch (e) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/cancelled-popup-request' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      const { signInWithRedirect } = await import('firebase/auth')
      return signInWithRedirect(auth, provider)
    }
    throw e
  }
}

/** Sign out current user (returns to the Google sign-in screen). */
export function signOutUser() { return auth ? auth.signOut() : Promise.resolve() }

/** Subscribe to auth state. cb(user|null); user.isAnonymous distinguishes baseline. */
export function watchAuth(cb) {
  if (!auth) { cb(null); return () => {} }
  return onAuthStateChanged(auth, cb)
}

/**
 * Verify the admin's identity with Google sign-in — on an ISOLATED secondary
 * Firebase instance, so the primary app's anonymous session (which powers all
 * data sync) is never disturbed. Returns the verified lowercase email and then
 * immediately signs that secondary session out. Purely an identity check for
 * unlocking the Admin UI — it does NOT change who reads/writes the database.
 */
export async function verifyAdminGoogle() {
  if (!isFirebaseConfigured) throw new Error('Cloud not configured')
  const NAME = 'adminVerify'
  let secondary
  try { secondary = getApp(NAME) } catch { secondary = initializeApp(firebaseConfig, NAME) }
  const aAuth = getAuth(secondary)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const cred = await signInWithPopup(aAuth, provider)
  const email = (cred.user.email || '').toLowerCase()
  await aAuth.signOut().catch(() => {})
  return email
}
