/**
 * Reports — Admin only. Date-wise / Party-wise / Material-wise breakdown of
 * material sent (OUT) and received (IN), plus pending. Set-off adjustments are
 * excluded from Sent/Received (they are not real material) but DO count toward
 * Pending, so Pending here matches the dashboard.
 */
import { useState } from 'react'
import { fmtDate } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { filterMoves, EMPTY_FILTER } from '../logic/filters'
import FilterBar from '../components/FilterBar'

const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0)

/** Aggregate sent/received/pending grouped by a key function. */
function aggregate(moves, keyFn) {
  const map = new Map()
  for (const m of moves) {
    const k = keyFn(m)
    const row = map.get(k) || { key: k, sent: 0, received: 0, balance: 0 }
    const q = m.quantity
    // Pending counts every movement (incl. set-off) so it matches the dashboard.
    row.balance += m.direction === 'out' ? q : -q
    // Sent / received = REAL material only (exclude set-off adjustments).
    if (!m.setoff) {
      if (m.direction === 'out') row.sent += q
      else row.received += q
    }
    map.set(k, row)
  }
  return [...map.values()]
}

export default function Reports() {
  const { moves: allMoves, parties, products } = useJobWork()
  const [mode, setMode] = useState('party')
  const [filter, setFilter] = useState(EMPTY_FILTER)
  const moves = filterMoves(allMoves, filter)

  const totalSent = sum(moves.filter(m => m.direction === 'out' && !m.setoff), m => m.quantity)
  const totalRecv = sum(moves.filter(m => m.direction === 'in' && !m.setoff), m => m.quantity)
  const totalPending = sum(moves, m => (m.direction === 'out' ? m.quantity : -m.quantity))

  let rows, label, sortFn, fmtKey, showPending
  if (mode === 'party') {
    rows = aggregate(moves, m => m.party); label = 'Party'; showPending = true
    sortFn = (a, b) => b.balance - a.balance; fmtKey = (k) => k
  } else if (mode === 'material') {
    rows = aggregate(moves, m => m.product); label = 'Material'; showPending = true
    sortFn = (a, b) => b.balance - a.balance; fmtKey = (k) => k
  } else {
    rows = aggregate(moves, m => m.date); label = 'Date'; showPending = false
    sortFn = (a, b) => (b.key || '').localeCompare(a.key || ''); fmtKey = (k) => fmtDate(k)
  }
  rows = rows.sort(sortFn)

  const modes = [
    { k: 'party', t: 'Party-wise' },
    { k: 'material', t: 'Material-wise' },
    { k: 'date', t: 'Date-wise' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-0 z-10 no-print">
        <div className="max-w-2xl mx-auto flex gap-2">
          {modes.map(x => (
            <button key={x.k} onClick={() => setMode(x.k)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode === x.k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>{x.t}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <FilterBar parties={parties} products={products} value={filter} onChange={setFilter} />

        {/* Totals strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{totalSent}</div>
            <div className="text-xs text-slate-400 mt-0.5">Sent (OUT)</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{totalRecv}</div>
            <div className="text-xs text-slate-400 mt-0.5">Received (IN)</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <div className={`text-2xl font-bold ${totalPending > 0 ? 'text-amber-600' : totalPending < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{totalPending}</div>
            <div className="text-xs text-slate-400 mt-0.5">Pending</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-semibold">{label}</th>
                <th className="text-right px-4 py-2.5 font-semibold">Sent</th>
                <th className="text-right px-4 py-2.5 font-semibold">Received</th>
                {showPending && <th className="text-right px-4 py-2.5 font-semibold">Pending</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={showPending ? 4 : 3} className="px-4 py-6 text-center text-slate-400">No data</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.key}>
                  <td className="px-4 py-2.5 font-medium text-slate-700">{fmtKey(r.key)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{r.sent}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{r.received}</td>
                  {showPending && (
                    <td className={`px-4 py-2.5 text-right font-bold ${r.balance > 0 ? 'text-amber-600' : r.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {r.balance > 0 ? `${r.balance} pending` : r.balance < 0 ? `${Math.abs(r.balance)} excess` : '✓ Clear'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
