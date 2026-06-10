import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
const cfg = { apiKey:'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM', authDomain:'unico-operations.firebaseapp.com', projectId:'unico-operations', storageBucket:'unico-operations.firebasestorage.app', messagingSenderId:'367786260524', appId:'1:367786260524:web:ae49d5da0ef1a71a9e3989' }
const db = getFirestore(initializeApp(cfg)); await signInAnonymously(getAuth(db.app))
const ref = doc(db,'apps','platingjobwork','meta','products')
const list = (await getDoc(ref)).data()?.list || []
const cleaned = list.filter(p => !p.startsWith('ZZ'))
await setDoc(ref,{list:cleaned})
console.log('removed test products. count now:', cleaned.length)
process.exit(0)
