/**
 * JobWorkContext — module-wide reactive state: challans, parties, products,
 * audit logs, and the challan-number counter, plus high-level actions.
 *
 * Two backends provide the SAME context shape:
 *   • LocalJobWorkProvider  — localStorage (offline, single-device)
 *   • FirestoreProvider     — cloud real-time sync (multi-device)
 * `JobWorkProvider` picks Firestore when configured, else local — so every
 * page works unchanged regardless of backend.
 */
import { createContext, useContext, useCallback } from 'react'
import { useCollection, useSingleton } from '../../core/hooks/useCollection'
import { challansRepo, logsRepo, usersRepo, incomingRepo, counterStore, partiesStore, productsStore, lastUsedStore } from './data'
import { formatChallanNo, flattenChallans } from './logic/challan'
import { isFirebaseConfigured } from '../../core/db/firebaseConfig'
import { FirestoreProvider } from './FirestoreProvider'

const Ctx = createContext(null)
export { Ctx as JobWorkCtx }

/** Backend selector. */
export function JobWorkProvider({ children }) {
  return isFirebaseConfigured
    ? <FirestoreProvider>{children}</FirestoreProvider>
    : <LocalJobWorkProvider>{children}</LocalJobWorkProvider>
}

/** localStorage-backed provider (offline / single-device). */
export function LocalJobWorkProvider({ children }) {
  const challans = useCollection(challansRepo)
  const logs = useCollection(logsRepo)
  const users = useCollection(usersRepo)
  const incoming = useCollection(incomingRepo)
  const [parties, setParties]   = useSingleton(partiesStore)
  const [products, setProducts] = useSingleton(productsStore)
  const [counter, setCounter]   = useSingleton(counterStore)

  /** Append an audit-log line. */
  const log = useCallback((action, detail, by = 'user') => {
    logs.insert({ ts: new Date().toISOString(), action, detail, by })
  }, [logs])

  /** Highest numeric suffix among existing challan numbers (authoritative). */
  const highestExistingNo = useCallback(() => {
    let max = 0
    for (const c of challans.list) {
      const m = /(\d+)\s*$/.exec(c.challanNo || '')
      if (m) max = Math.max(max, Number(m[1]))
    }
    return max
  }, [challans.list])

  /**
   * Create a challan from {date,party,direction,gaadi,items[]} with a
   * GUARANTEED-UNIQUE number. The next number is derived from the greater of
   * the stored counter and the highest existing challan number (so a restored
   * backup or a drifted counter can never reissue a used number), and a final
   * guard bumps past any collision before inserting.
   */
  const createChallan = useCallback((draft) => {
    const existing = new Set(challans.list.map(c => c.challanNo))
    let n = Math.max(counter || 0, highestExistingNo()) + 1
    let challanNo = formatChallanNo(n)
    while (existing.has(challanNo)) {        // defensive: never duplicate
      n += 1
      challanNo = formatChallanNo(n)
    }
    setCounter(n)
    const row = challans.insert({ ...draft, challanNo, reconciled: false, reconcileReason: '' })
    log('CREATE', `${challanNo} · ${draft.direction.toUpperCase()} · ${draft.party} · ${draft.items.length} item(s)`)
    return row
  }, [challans, counter, setCounter, highestExistingNo, log])

  /** Preview the number the NEXT created challan will receive (no side-effect). */
  const peekNextChallanNo = useCallback(
    () => formatChallanNo(Math.max(counter || 0, highestExistingNo()) + 1),
    [counter, highestExistingNo]
  )

  /**
   * Bulk-import challans (e.g. from Excel), each given a guaranteed-unique
   * sequential number. Returns the count inserted.
   */
  const importChallans = useCallback((drafts) => {
    const existing = new Set(challans.list.map(c => c.challanNo))
    let n = Math.max(counter || 0, highestExistingNo())
    let added = 0
    for (const d of drafts) {
      let no
      do { n += 1; no = formatChallanNo(n) } while (existing.has(no))
      existing.add(no)
      challans.insert({ ...d, challanNo: no, reconciled: false, reconcileReason: '' })
      added++
    }
    setCounter(n)
    log('IMPORT', `Imported ${added} challans${drafts[0] ? ' for ' + drafts[0].party : ''}`, 'admin')
    return added
  }, [challans, counter, setCounter, highestExistingNo, log])

  const value = {
    challans,                       // collection API (.list, .insert, .update, .remove, ...)
    moves: flattenChallans(challans.list), // flattened movements for balance logic
    logs,
    users,
    incoming,
    parties, setParties,
    products, setProducts,
    lastUsed: lastUsedStore,
    createChallan,
    peekNextChallanNo,
    importChallans,
    log,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useJobWork() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useJobWork must be used inside <JobWorkProvider>')
  return v
}
