/**
 * Modify Challans — search/filter, edit & delete. Challans older than the lock
 * window (24h) are read-only here and must be edited in Admin (reconciliation).
 */
import { useState } from 'react'
import { Select, SearchBar } from '../../../core/ui'
import { fmtDate } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { isLocked, ageLabel, challanTotalQty } from '../logic/challan'
import ChallanEditor from '../components/ChallanEditor'

export default function ModifyEntry() {
  // Access is controlled by role (Manager + Admin); no separate password here.
  return <ModifyEntryInner />
}

function ModifyEntryInner() {
  const { challans, parties, products, log } = useJobWork()
  const [filterParty, setFilterParty] = useState('all')
  const [filterDir, setFilterDir] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const now = Date.now()

  // Only challans within the 24h edit window appear here. Older challans drop
  // off this page entirely and can be changed only in Admin → Reconcile.
  const editable = challans.list.filter(c => !isLocked(c, now))
  const hiddenOlder = challans.list.length - editable.length

  const q = search.trim().toLowerCase()
  const rows = editable
    .filter(c => filterParty === 'all' || c.party === filterParty)
    .filter(c => filterDir === 'all' || c.direction === filterDir)
    .filter(c => !q
      || (c.challanNo || '').toLowerCase().includes(q)
      || c.party.toLowerCase().includes(q)
      || (c.gaadi || '').toLowerCase().includes(q)
      || (c.items || []).some(it => it.product.toLowerCase().includes(q)))
    .sort((a, b) => (b.date || '').localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))

  const saveEdit = (updated) => {
    // Audit old→new (fix 2026-07-18): quantity edits move party balances — the bare "edited"
    // log line hid WHAT changed. Record each changed field/item as before→after.
    const before = challans.list.find(c => c.id === updated.id) || {}
    const diffs = []
    if (before.date !== updated.date) diffs.push(`date ${before.date}→${updated.date}`)
    if (before.party !== updated.party) diffs.push(`party ${before.party}→${updated.party}`)
    const bi = before.items || [], ui = updated.items || []
    for (const name of [...new Set([...bi.map(i => i.product), ...ui.map(i => i.product)])]) {
      const b = bi.find(i => i.product === name), u = ui.find(i => i.product === name)
      if ((b?.quantity ?? '—') !== (u?.quantity ?? '—')) diffs.push(`${name} ${b?.quantity ?? '—'}→${u?.quantity ?? '—'}`)
    }
    challans.update(updated.id, updated)
    log('EDIT', `${updated.challanNo} edited${diffs.length ? ' · ' + diffs.join(', ') : ''}`)
    setEditing(null)
  }
  const small = 'border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-200 bg-white'

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto space-y-2.5">
          <SearchBar value={search} onChange={setSearch} placeholder="Search challan no, party, product or gaadi…" />
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={filterParty} onChange={e => setFilterParty(e.target.value)} className={small}
              options={[{ value: 'all', label: 'All Parties' }, ...parties.map(p => ({ value: p, label: p }))]} />
            <Select value={filterDir} onChange={e => setFilterDir(e.target.value)} className={small}
              options={[{ value: 'all', label: 'Both Directions' }, { value: 'out', label: 'Outgoing only' }, { value: 'in', label: 'Incoming only' }]} />
            <span className="text-xs text-slate-400 ml-auto font-semibold">{rows.length} editable</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-2">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
          Showing only challans entered in the last 24 hours.
          {hiddenOlder > 0 && <> {hiddenOlder} older challan{hiddenOlder > 1 ? 's are' : ' is'} locked — edit them in <strong>Admin → Reconcile</strong>.</>}
        </div>

        {rows.length === 0 && <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center text-slate-400">No editable challans in the last 24 hours</div>}

        {rows.map(c => {
          if (editing === c.id) {
            return (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <ChallanEditor challan={c} parties={parties} products={products}
                  onSave={saveEdit} onCancel={() => setEditing(null)} />
              </div>
            )
          }
          return (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${c.direction === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {c.direction === 'out' ? 'OUT' : 'IN'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-700 text-sm">
                      <span className="font-mono text-xs text-slate-400">{c.challanNo}</span> · {c.party}
                      {c.reconciled && <span className="ml-1 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">reconciled</span>}
                    </div>
                    <div className="text-xs text-slate-400">{fmtDate(c.date)}{c.gaadi ? ` · ${c.gaadi}` : ''} · {ageLabel(c.createdAt, now)}</div>
                  </div>
                  <div className="font-bold text-slate-700 mr-1">{challanTotalQty(c)} pcs</div>
                  <button onClick={() => setEditing(c.id)} className="text-slate-400 hover:text-blue-600 p-1.5" title="Edit">✏️</button>
                </div>
                {/* line items */}
                <div className="mt-2 pl-13 flex flex-wrap gap-1.5">
                  {(c.items || []).map((it, i) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">{it.product}: {it.quantity}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
