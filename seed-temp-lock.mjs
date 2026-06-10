import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore'
const cfg = {
  apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM', authDomain: 'unico-operations.firebaseapp.com',
  projectId: 'unico-operations', storageBucket: 'unico-operations.firebasestorage.app',
  messagingSenderId: '367786260524', appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989',
}
const app = initializeApp(cfg); const db = getFirestore(app)
await signInAnonymously(getAuth(app))
const ref = doc(db, 'apps', 'platingjobwork', 'challans', 'TMPLOCKTEST')
if (process.argv[2] === 'del') {
  await deleteDoc(ref); console.log('temp challan deleted')
} else {
  const old = new Date(); old.setDate(old.getDate() - 2) // 2 days ago
  await setDoc(ref, {
    id: 'TMPLOCKTEST', challanNo: 'PJW-9999', date: '2026-05-31', party: 'Sriram', direction: 'out',
    gaadi: '', items: [{ product: 'Spider', quantity: 7 }], reconciled: false, reconcileReason: '',
    createdAt: old.toISOString(),
  })
  console.log('temp backdated challan PJW-9999 added (createdAt 2 days ago)')
}
process.exit(0)
