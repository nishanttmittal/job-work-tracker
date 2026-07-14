/**
 * Firestore-backed module state — real-time, multi-device, offline-capable.
 *
 * Exposes the SAME value shape as the local provider (challans/.list/.insert/…,
 * logs, parties, products, createChallan, importChallans, peekNextChallanNo,
 * log) so every page works unchanged. Differences vs local:
 *   • challans & logs are per-document Firestore collections → concurrent edits
 *     on different devices never clobber each other.
 *   • challan numbers come from an atomic Firestore counter (no duplicates).
 *   • onSnapshot listeners push live updates from any device into React state.
 *   • Firestore's IndexedDB cache makes it work offline and auto-sync on
 *     reconnect.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore'
import { onSnapshot, getDocs } from '../../core/db/readmeter'   // metered reads → usage_reads (quota diagnosis)
import { db, paths, ensureSignedIn, reserveChallanNumber, reserveChallanBlock, watchAuth } from '../../core/db/firebase'
import { makeNormalizer } from '../../core/schema/field'
import { makeId } from '../../core/db/repository'
import { flattenChallans, formatChallanNo } from './logic/challan'
import { normalizeProductName } from '../../core/utils/format'
import { challanSchema, incomingSchema } from './schema'
import { DEFAULT_PARTIES, DEFAULT_PRODUCTS } from './config'
import { lastUsedStore } from './data'
import { JobWorkCtx } from './JobWorkContext'

const normalize = makeNormalizer(challanSchema)
const normIncoming = makeNormalizer(incomingSchema)

export function FirestoreProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [challansList, setChallansList] = useState([])
  const [logsList, setLogsList] = useState([])
  const [usersList, setUsersList] = useState([])
  const [incomingList, setIncomingList] = useState([])
  const [parties, setPartiesState] = useState(DEFAULT_PARTIES)
  const [products, setProductsState] = useState(DEFAULT_PRODUCTS)
  const [matchLinks, setMatchLinksState] = useState([])
  const [counter, setCounter] = useState(0)

  const [timedOut, setTimedOut] = useState(false)
  // authKey changes anon -> Google so data listeners re-subscribe after login
  // (else listeners attached while anonymous stay permission-denied once the
  // data collections are allowlist-locked, and the app loads blank).
  const [authKey, setAuthKey] = useState('anon')
  useEffect(() => watchAuth((u) => setAuthKey(u ? `${u.uid}:${u.email || ''}` : 'none')), [])

  // Baseline anonymous sign-in + readiness probe (runs once). `users` stays
  // readable by any signed-in device (incl. anonymous) so the app can resolve
  // the Google role before login; the data collections below are allowlist-locked.
  useEffect(() => {
    let done = false
    const timer = setTimeout(() => { if (!done) setTimedOut(true) }, 12000)
    const unsub = onSnapshot(paths.users(),
      () => { done = true; clearTimeout(timer); setReady(true) },
      (e) => { done = true; clearTimeout(timer); setError(e.message); setReady(true) })
    ensureSignedIn().catch((e) => { done = true; clearTimeout(timer); setError(e.message); setTimedOut(true) })
    return () => { clearTimeout(timer); unsub() }
  }, [])

  // Data listeners — re-subscribe when the signed-in user changes (anon ->
  // Google) so locked collections load AFTER sign-in instead of staying denied.
  // Error callbacks tolerate permission-denied (non-allowlisted = empty, no crash).
  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(paths.challans(),
      (snap) => setChallansList(snap.docs.map(d => normalize({ id: d.id, ...d.data() }))),
      () => setChallansList([])))
    unsubs.push(onSnapshot(paths.logs(),
      (snap) => setLogsList(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setLogsList([])))
    unsubs.push(onSnapshot(paths.parties(),
      (snap) => { if (snap.exists() && Array.isArray(snap.data().list)) setPartiesState(snap.data().list) },
      () => {}))
    unsubs.push(onSnapshot(paths.products(),
      (snap) => { if (snap.exists() && Array.isArray(snap.data().list)) setProductsState(snap.data().list) },
      () => {}))
    unsubs.push(onSnapshot(paths.matchlinks(),
      (snap) => { if (snap.exists() && Array.isArray(snap.data().list)) setMatchLinksState(snap.data().list) },
      () => {}))
    unsubs.push(onSnapshot(paths.counter(),
      (snap) => setCounter(snap.exists() ? (snap.data().value || 0) : 0),
      () => {}))
    unsubs.push(onSnapshot(paths.users(),
      (snap) => setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setUsersList([])))
    unsubs.push(onSnapshot(paths.incoming(),
      (snap) => setIncomingList(snap.docs.map(d => normIncoming({ id: d.id, ...d.data() }))),
      () => setIncomingList([])))
    return () => unsubs.forEach(u => u())
  }, [authKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── writers ──────────────────────────────────────────────────────────────
  const setParties = useCallback((list) => { setPartiesState(list); setDoc(paths.parties(), { list }) }, [])
  const setProducts = useCallback((list) => { setProductsState(list); setDoc(paths.products(), { list }) }, [])
  const setMatchLinks = useCallback((list) => { setMatchLinksState(list); setDoc(paths.matchlinks(), { list }) }, [])

  /**
   * Canonicalise a list of line items (normalize product names) and auto-register
   * any product not yet in the catalogue. The single chokepoint every write path
   * (New Challan, welder Accept, Modify/Admin editor, product rename, import) runs
   * through, so the products registry stays self-healing and the same physical
   * product always matches as ONE string across apps. Returns the normalized items.
   */
  const ingestProducts = useCallback((items) => {
    const norm = (items || []).map(it => ({ ...it, product: normalizeProductName(it.product) }))
    const known = new Set(products)
    const fresh = [...new Set(norm.map(it => it.product).filter(p => p && !known.has(p)))]
    if (fresh.length) setProducts([...products, ...fresh])
    return norm
  }, [products, setProducts])

  const log = useCallback((action, detail, by = 'user') => {
    const id = makeId('log')
    setDoc(paths.logDoc(id), { id, ts: new Date().toISOString(), action, detail, by })
  }, [])

  const challans = {
    list: challansList,
    insert: (rec) => {
      const id = rec.id || makeId('c')
      const row = { createdAt: new Date().toISOString(), ...rec, id }
      if (Array.isArray(rec.items)) row.items = ingestProducts(rec.items)
      setDoc(paths.challan(id), row)
      return row
    },
    update: (id, patch) => setDoc(
      paths.challan(id),
      Array.isArray(patch.items) ? { ...patch, items: ingestProducts(patch.items) } : patch,
      { merge: true },
    ),
    remove: (id) => deleteDoc(paths.challan(id)),
    removeWhere: (pred) => {
      const hit = challansList.filter(pred)
      const batch = writeBatch(db)
      hit.forEach(c => batch.delete(paths.challan(c.id)))
      batch.commit()
      return hit.length
    },
    replaceAll: async (list) => {
      // restore: clear then write all
      const existing = await getDocs(paths.challans())
      const b1 = writeBatch(db); existing.forEach(d => b1.delete(d.ref)); await b1.commit()
      const b2 = writeBatch(db)
      list.forEach(c => { const id = c.id || makeId('c'); b2.set(paths.challan(id), { ...c, id }) })
      await b2.commit()
    },
    reset: async () => {
      const existing = await getDocs(paths.challans())
      const b = writeBatch(db); existing.forEach(d => b.delete(d.ref)); await b.commit()
    },
  }

  const logs = { list: logsList, insert: (rec) => log(rec.action, rec.detail, rec.by) }

  const users = {
    list: usersList,
    insert: (rec) => { const id = rec.id || makeId('u'); const row = { ...rec, id }; setDoc(paths.user(id), row); return row },
    update: (id, patch) => setDoc(paths.user(id), patch, { merge: true }),
    remove: (id) => deleteDoc(paths.user(id)),
  }

  const incoming = {
    list: incomingList,
    update: (id, patch) => setDoc(paths.incomingDoc(id), patch, { merge: true }),
    remove: (id) => deleteDoc(paths.incomingDoc(id)),
  }

  /** Create one challan with a server-issued unique number (async). */
  const createChallan = useCallback(async (draft) => {
    const n = await reserveChallanNumber()
    const challanNo = formatChallanNo(n)
    const id = makeId('c')
    const items = ingestProducts(draft.items)
    const row = { ...draft, items, id, challanNo, reconciled: false, reconcileReason: '', createdAt: new Date().toISOString() }
    await setDoc(paths.challan(id), row)
    log('CREATE', `${challanNo} · ${draft.direction.toUpperCase()} · ${draft.party} · ${items.length} item(s)`)
    return row
  }, [log, ingestProducts])

  /** Bulk import — reserve a contiguous block of numbers atomically. */
  const importChallans = useCallback(async (drafts) => {
    if (!drafts.length) return 0
    // Canonicalise product names and register any new ones (single merge).
    const normDrafts = drafts.map(d => ({ ...d, items: (d.items || []).map(it => ({ ...it, product: normalizeProductName(it.product) })) }))
    const known = new Set(products)
    const fresh = [...new Set(normDrafts.flatMap(d => d.items.map(it => it.product)).filter(p => p && !known.has(p)))]
    if (fresh.length) setProducts([...products, ...fresh])
    const start = await reserveChallanBlock(normDrafts.length)
    const batch = writeBatch(db)
    normDrafts.forEach((d, i) => {
      const id = makeId('c')
      batch.set(paths.challan(id), {
        ...d, id, challanNo: formatChallanNo(start + i),
        reconciled: false, reconcileReason: '', createdAt: new Date().toISOString(),
      })
    })
    await batch.commit()
    log('IMPORT', `Imported ${normDrafts.length} challans${normDrafts[0] ? ' for ' + normDrafts[0].party : ''}`, 'admin')
    return normDrafts.length
  }, [log, products, setProducts])

  const peekNextChallanNo = useCallback(() => formatChallanNo((counter || 0) + 1), [counter])

  if (!ready && timedOut) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4 p-6 text-center">
        <div className="text-4xl">📡</div>
        <div className="text-base font-bold">Can't reach the cloud</div>
        <div className="text-sm text-slate-300 max-w-xs">
          Check your internet connection and try again. If this keeps happening,
          the app's web address may need to be authorised in Firebase.
        </div>
        <button onClick={() => window.location.reload()}
          className="mt-2 bg-white text-slate-900 rounded-xl px-6 py-3 font-bold text-sm">Retry</button>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
        <div className="text-2xl">☁️</div>
        <div className="text-sm text-slate-300">Connecting to cloud…</div>
      </div>
    )
  }

  const value = {
    challans,
    moves: flattenChallans(challansList),
    logs,
    users,
    incoming,
    parties, setParties,
    products, setProducts,
    matchLinks, setMatchLinks,
    lastUsed: lastUsedStore,
    createChallan,
    peekNextChallanNo,
    importChallans,
    log,
    cloud: { connected: !error, error },
  }
  return <JobWorkCtx.Provider value={value}>{children}</JobWorkCtx.Provider>
}
