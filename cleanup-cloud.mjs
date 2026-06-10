import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, collection, getDocs, writeBatch, doc, setDoc } from 'firebase/firestore'
const cfg = {
  apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM', authDomain: 'unico-operations.firebaseapp.com',
  projectId: 'unico-operations', storageBucket: 'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524', appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}
const app = initializeApp(cfg); const db = getFirestore(app)
await signInAnonymously(getAuth(app))
const NS = 'platingjobwork'
for (const col of ['challans', 'logs']) {
  const snap = await getDocs(collection(db, 'apps', NS, col))
  const batch = writeBatch(db); snap.forEach(d => batch.delete(d.ref)); await batch.commit()
  console.log(`cleared ${col}: ${snap.size} docs`)
}
await setDoc(doc(db, 'apps', NS, 'meta', 'counter'), { value: 0 })
console.log('counter reset to 0 — cloud is clean, next challan = PJW-0001')
process.exit(0)
