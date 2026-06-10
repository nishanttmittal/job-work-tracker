import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore'
const cfg = {
  apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM', authDomain: 'unico-operations.firebaseapp.com',
  projectId: 'unico-operations', storageBucket: 'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524', appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}
const app = initializeApp(cfg); const db = getFirestore(app)
await signInAnonymously(getAuth(app))
const NS = 'platingjobwork'
const snap = await getDocs(collection(db, 'apps', NS, 'challans'))
const all = snap.docs.map(d => d.data())
const nos = all.map(c => c.challanNo)
const counter = (await getDoc(doc(db, 'apps', NS, 'meta', 'counter'))).data()

console.log('CLOUD VERIFICATION')
console.log('  Total challans in cloud:', all.length)
console.log('  Unique numbers:', new Set(nos).size, new Set(nos).size === nos.length ? '✅ no duplicates' : '❌ DUPLICATES')
console.log('  By party:', JSON.stringify(all.reduce((a, c) => { a[c.party] = (a[c.party]||0)+1; return a }, {})))
console.log('  By direction:', JSON.stringify(all.reduce((a, c) => { a[c.direction] = (a[c.direction]||0)+1; return a }, {})))
console.log('  Counter value:', counter?.value)
// spot check
const sept9 = all.find(c => c.party === 'Sriram' && c.date === '2025-09-09' && c.direction === 'out')
if (sept9) console.log('  Spot check 2025-09-09 OUT items:', JSON.stringify(sept9.items))
const sample = all.slice(0, 3).map(c => `${c.challanNo}:${c.date}:${c.direction}:${c.items.length}items`)
console.log('  Samples:', sample.join('  '))
process.exit(0)
