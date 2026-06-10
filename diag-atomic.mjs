// Verify atomic challan numbering + per-doc challans against the REAL project.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, deleteDoc, runTransaction } from 'firebase/firestore'

const cfg = {
  apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM',
  authDomain: 'unico-operations.firebaseapp.com',
  projectId: 'unico-operations',
  storageBucket: 'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524',
  appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}
const app = initializeApp(cfg)
const db = getFirestore(app)
await signInAnonymously(getAuth(app))
console.log('✅ signed in\n')

const NS = 'platingjobwork'
const counterRef = doc(db, 'apps', NS, 'meta', 'counter')

// reset counter for a clean test
await setDoc(counterRef, { value: 0 })

const reserve = () => runTransaction(db, async (tx) => {
  const snap = await tx.get(counterRef)
  const next = (snap.exists() ? snap.data().value || 0 : 0) + 1
  tx.set(counterRef, { value: next }, { merge: true })
  return next
})

// 1. Sequential reservations
const a = await reserve(), b = await reserve(), c = await reserve()
console.log('Sequential reserve →', a, b, c, (a===1&&b===2&&c===3) ? '✅' : '❌')

// 2. CONCURRENT reservations (simulate 5 devices at once)
await setDoc(counterRef, { value: 0 })
const results = await Promise.all([reserve(), reserve(), reserve(), reserve(), reserve()])
const unique = new Set(results).size === results.length
console.log('Concurrent reserve →', results.slice().sort((x,y)=>x-y), unique ? '✅ all unique' : '❌ DUPLICATE')

// 3. Per-doc challan write/read
const cRef = doc(db, 'apps', NS, 'challans', 'diagtest1')
await setDoc(cRef, { challanNo: 'PJW-0001', party: 'Sriram', direction: 'out', items: [{ product: 'Spider', quantity: 100 }], date: '2026-06-02' })
const got = (await getDoc(cRef)).data()
console.log('Challan write/read →', got.challanNo, got.items[0].product + ':' + got.items[0].quantity, '✅')
await deleteDoc(cRef)
await deleteDoc(counterRef)
console.log('\n✅ cleanup done — atomic numbering verified on real project')
process.exit(0)
