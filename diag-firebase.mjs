// Diagnostic: probe the real Firebase project to see what's enabled.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain: 'unico-operations.firebaseapp.com',
  projectId: 'unico-operations',
  storageBucket: 'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

console.log('=== FIREBASE PROJECT DIAGNOSTIC: unico-operations ===\n')

// 1. Anonymous auth
let signedIn = false
try {
  const cred = await signInAnonymously(auth)
  signedIn = true
  console.log('✅ Anonymous auth ENABLED — uid:', cred.user.uid.slice(0, 8) + '…')
} catch (e) {
  console.log('❌ Anonymous auth NOT enabled →', e.code || e.message)
  console.log('   (Enable: Console → Authentication → Sign-in method → Anonymous)')
}

// 2. Firestore write/read (under /apps/platingjobwork/_diag/test)
const ref = doc(db, 'apps', 'platingjobwork', '_diag', 'test')
try {
  await setDoc(ref, { hello: 'world', ts: Date.now() })
  const snap = await getDoc(ref)
  console.log('✅ Firestore WRITE+READ ok →', JSON.stringify(snap.data()))
  await deleteDoc(ref)
  console.log('✅ Firestore DELETE ok (cleanup)')
} catch (e) {
  console.log('❌ Firestore access FAILED →', e.code || e.message)
  if ((e.code || '').includes('permission')) {
    console.log('   → Rules are blocking. Either publish firestore.rules, or')
    console.log('     the test-mode window expired. Signed in:', signedIn)
  }
}

process.exit(0)
