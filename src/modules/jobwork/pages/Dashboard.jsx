/**
 * Dashboard — party-wise pending summary, 7-day aging reminders, red-flag
 * alerts (IN > OUT) and per-party product balances.
 */
import { useState } from 'react'
import { fmtDate } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { findRedFlags, partyBalances, partyWisePending, findAgingOut } from '../logic/balance'
import { OUT_REMINDER_DAYS } from '../config'

export default function Dashboard() {
  const { moves, challans, parties, products } = useJobWork()
  const [view, setView] = useState('all')

  // The View filter applies to the WHOLE dashboard — summary, alerts,
  // reminders, reconciliations, recent and the detail tables all respect it.
  const viewParties = view === 'all' ? parties : [view]
  const inView = (party) => view === 'all' || party === view

  const summary = partyWisePending(moves, viewParties, products)
  const flags = findRedFlags(moves, viewParties, products)
  const aging = findAgingOut(moves, viewParties, products, OUT_REMINDER_DAYS)
  const recent = [...challans.list]
    .filter(c => inView(c.party))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5)
  const reconciled = challans.list.filter(c => c.reconciled && inView(c.party))
  const shownParties = viewParties

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Party filter */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 no-print">
        <div className="max-w-2xl mx-auto flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-slate-600">View:</span>
          {['all', ...parties].map(p => (
            <button key={p} onClick={() => setView(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${view === p ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {p === 'all' ? 'All Parties' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5">

        {/* Party-wise pending summary — total + product-name-wise balance.
            Positive = pending (amber). Negative = excess received (red). */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">Party-wise Pending Material</h3>
            {(() => {
              const net = summary.reduce((s, x) => s + x.pending, 0)
              return <span className={`text-xs font-bold ${net < 0 ? 'text-red-600' : 'text-amber-600'}`}>Net: {net} pcs</span>
            })()}
          </div>
          <div className="divide-y divide-slate-100">
            {summary.map(s => (
              <button key={s.party} onClick={() => setView(s.party)}
                className="w-full text-left px-4 py-3 active:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{s.party}</span>
                  <span className={`text-lg font-bold ${s.pending > 0 ? 'text-amber-600' : s.pending < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {s.pending} <span className="text-xs font-medium text-slate-400">pcs</span>
                  </span>
                </div>
                {s.breakdown.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.breakdown.map(b => (
                      <span key={b.product}
                        className={`text-xs px-2 py-1 rounded-lg font-semibold border ${
                          b.balance < 0
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                        {b.product}: {b.balance > 0 ? b.balance : b.balance}
                        {b.balance < 0 && <span className="ml-1 text-[10px] font-bold">(excess)</span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-emerald-600 font-medium">✓ All clear — nothing pending</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 7-day aging reminder */}
        {aging.length > 0 && (
          <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl overflow-hidden">
            <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-2">
              <span className="text-lg">⏰</span><span className="font-bold">Pending Over {OUT_REMINDER_DAYS} Days ({aging.length})</span>
            </div>
            <div className="divide-y divide-orange-100">
              {aging.map((a, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div><span className="font-semibold text-orange-800 text-sm">{a.party}</span>
                    <span className="text-orange-400 mx-1.5">·</span><span className="text-orange-700 text-sm">{a.product}</span></div>
                  <div className="text-right">
                    <div className="text-orange-700 font-bold text-sm">{a.pending} pcs pending</div>
                    <div className="text-xs text-orange-400">out since {fmtDate(a.since)} · {a.ageDays} days</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Red flags */}
        {flags.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl overflow-hidden">
            <div className="bg-red-600 text-white px-4 py-3 flex items-center gap-2">
              <span className="text-lg">🚩</span><span className="font-bold">Alerts — IN Exceeds OUT ({flags.length})</span>
            </div>
            <div className="divide-y divide-red-100">
              {flags.map((f, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div><span className="font-semibold text-red-800 text-sm">{f.party}</span>
                    <span className="text-red-400 mx-1.5">·</span><span className="text-red-700 text-sm">{f.product}</span></div>
                  <div className="text-right">
                    <div className="text-red-700 font-bold text-sm">Excess IN: {f.excess} pcs</div>
                    <div className="text-xs text-red-400">OUT: {f.out} · IN: {f.in}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {flags.length === 0 && aging.length === 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-emerald-600 text-lg">✓</span>
            <span className="text-emerald-700 text-sm font-medium">No alerts — all balances are normal</span>
          </div>
        )}

        {/* Per-party balance tables */}
        {shownParties.map(party => {
          const rows = partyBalances(moves, party, products)
          if (rows.length === 0) return (
            <div key={party} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-3 font-bold">{party}</div>
              <div className="px-4 py-6 text-center text-slate-400 text-sm">No entries yet</div>
            </div>
          )
          const tOut = rows.reduce((s, r) => s + r.out, 0)
          const tIn = rows.reduce((s, r) => s + r.in, 0)
          const tBal = tOut - tIn
          return (
            <div key={party} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-3 flex items-center justify-between">
                <span className="font-bold">{party}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${tBal > 0 ? 'bg-amber-400/20 text-amber-200' : tBal < 0 ? 'bg-red-400/20 text-red-200' : 'bg-emerald-400/20 text-emerald-200'}`}>
                  Net Pending: {tBal} pcs
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5 font-semibold">Product</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Out</th>
                    <th className="text-right px-4 py-2.5 font-semibold">In</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ product, out, in: inn, balance }) => {
                    const alert = inn > out
                    return (
                      <tr key={product} className={alert ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{alert && '🚩 '}{product}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{out}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{inn}</td>
                        <td className={`px-4 py-2.5 text-right font-bold ${balance > 0 ? 'text-amber-600' : balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {balance > 0 ? `${balance} pending` : balance < 0 ? `${Math.abs(balance)} excess` : '✓ Clear'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 border-t-2 border-slate-200 font-bold text-sm">
                    <td className="px-4 py-2.5 text-slate-700">TOTAL</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{tOut}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{tIn}</td>
                    <td className={`px-4 py-2.5 text-right ${tBal > 0 ? 'text-amber-600' : tBal < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {tBal > 0 ? `${tBal} pending` : tBal < 0 ? `${Math.abs(tBal)} excess` : '✓ Clear'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        })}

        {/* Reconciliation summary */}
        {reconciled.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-violet-200 overflow-hidden">
            <div className="bg-violet-600 text-white px-4 py-3 flex items-center gap-2">
              <span className="text-lg">🔧</span><span className="font-bold">Reconciliations ({reconciled.length})</span>
            </div>
            <div className="divide-y divide-violet-50">
              {[...reconciled].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5).map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700"><span className="font-mono text-xs text-violet-500">{c.challanNo}</span> · {c.party}</span>
                    <span className="text-xs text-slate-400">{fmtDate(c.date)}</span>
                  </div>
                  {c.reconcileReason && <div className="text-xs text-violet-600 mt-0.5">Reason: {c.reconcileReason}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent challans */}
        {recent.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100"><h3 className="font-bold text-slate-700 text-sm">Recent Challans</h3></div>
            <div className="divide-y divide-slate-50">
              {recent.map(c => {
                const pcs = (c.items || []).reduce((s, it) => s + Number(it.quantity), 0)
                return (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${c.direction === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {c.direction === 'out' ? 'OUT' : 'IN'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-700"><span className="font-mono text-xs text-slate-400">{c.challanNo}</span> · {c.party}</div>
                        <div className="text-xs text-slate-400">{fmtDate(c.date)} · {(c.items || []).length} item(s)</div>
                      </div>
                    </div>
                    <div className="font-bold text-slate-700">{pcs} pcs</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
