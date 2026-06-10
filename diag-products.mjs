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

// tally out/in per (party, product)
const tally = {}
for (const c of all) for (const it of c.items || []) {
  const key = c.party + ' | ' + it.product
  tally[key] = tally[key] || { out: 0, in: 0 }
  tally[key][c.direction] += Number(it.quantity) || 0
}
console.log('Per party+product (out / in / balance):')
Object.entries(tally).sort().forEach(([k, v]) => {
  console.log(`  ${k.padEnd(34)}  out ${String(v.out).padStart(5)}  in ${String(v.in).padStart(5)}  bal ${v.out - v.in}`)
})

console.log('\nDistinct product names seen in line items:')
const prods = [...new Set(all.flatMap(c => (c.items || []).map(i => i.product)))].sort()
prods.forEach(p => console.log('  [' + p + ']'))

const meta = (await getDoc(doc(db, 'apps', NS, 'meta', 'products'))).data()
console.log('\nProducts list (meta):')
;(meta?.list || []).forEach(p => console.log('  [' + p + ']'))
process.exit(0)
