// One-time cloud fix: merge duplicate product spellings into one canonical name.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, collection, getDocs, doc, getDoc, writeBatch, setDoc } from 'firebase/firestore'
const cfg = {
  apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM', authDomain: 'unico-operations.firebaseapp.com',
  projectId: 'unico-operations', storageBucket: 'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524', appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}
// from -> to   (merge the left spelling into the right one)
const RENAMES = { 'Frame reduce 1.5" nickel': 'Frame nickel 1.5"' }

const app = initializeApp(cfg); const db = getFirestore(app)
await signInAnonymously(getAuth(app))
const NS = 'platingjobwork'

const snap = await getDocs(collection(db, 'apps', NS, 'challans'))
let changed = 0
const batch = writeBatch(db)
snap.forEach(d => {
  const c = d.data()
  let touched = false
  const items = (c.items || []).map(it => {
    if (RENAMES[it.product]) { touched = true; return { ...it, product: RENAMES[it.product] } }
    return it
  })
  if (touched) { batch.update(d.ref, { items }); changed++ }
})
await batch.commit()
console.log(`renamed line items in ${changed} challans`)

// clean the products meta list (drop the merged-away names)
const pref = doc(db, 'apps', NS, 'meta', 'products')
const meta = (await getDoc(pref)).data()
if (meta?.list) {
  const cleaned = [...new Set(meta.list.map(p => RENAMES[p] || p))]
  await setDoc(pref, { list: cleaned })
  console.log('products list cleaned:', cleaned.length, 'items')
}
console.log('done')
process.exit(0)
