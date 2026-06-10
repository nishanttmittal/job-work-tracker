/**
 * Matching — challan-to-challan FIFO view.
 *
 * For each party + product, every OUT challan is paired against the oldest
 * returns (IN) that cleared it. Shows how much of each OUT challan is still
 * open, and any excess IN that couldn't be matched to an OUT.
 *
 * Manager: read-only. Admin: can RE-LINK a return to a specific OUT challan
 * (overriding oldest-first) for the rare case a plater returns a newer batch
 * before an older one. Overrides persist and are logged.
 */
import { useState } from 'react'
import { fmtDate } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { matchFIFO, matchablePairs } from '../logic/matching'

const byDate = (a, b) =>
  (a.date || '').localeCompare(b.date || '') || (a.challanNo || '').localeCompare(b.challanNo || '')

export default function Matching({ owner }) {
  const { moves, parties, matchLinks = [], setMatchLinks, log } = useJobWork()
  const [view, setView] = useState('all')

  const pairs = matchablePairs(moves).filter(p => view === 'all' || p.party === view)
  const byParty = {}
  for (const p of pairs) (byParty[p.party] = byParty[p.party] || []).push(p.product)

  const linkFor = (party, product, inChallanNo) =>
    matchLinks.find(o => o.party === party && o.product === product && o.inChallanNo === inChallanNo)?.outChallanNo || ''

  const setLink = (party, product, inChallanNo, outChallanNo) => {
    const rest = matchLinks.filter(o => !(o.party === party && o.product === product && o.inChallanNo === inChallanNo))
    const next = outChallanNo ? [...rest, { party, product, inChallanNo, outChallanNo }] : rest
    setMatchLinks?.(next)
    log?.('RELINK', `${party} · ${product} · IN ${inChallanNo} → ${outChallanNo || 'Auto (FIFO)'}`, 'admin')
  }

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

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          Each OUT challan is auto-matched (oldest first) against the returns received. Green = fully returned, amber = still open.
          {owner && <span className="block mt-1 text-blue-600">Admin: use “Re-link” to pin a return to a specific OUT challan.</span>}
        </div>

        {Object.keys(byParty).length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center text-slate-400">Nothing sent out yet.</div>
        )}

        {Object.entries(byParty).map(([party, prods]) => (
          <div key={party} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-700 text-white px-4 py-3 font-bold">{party}</div>
            <div className="divide-y divide-slate-100">
              {prods.map(product => {
                const { outs, excessIn, openOut } = matchFIFO(moves, party, product, matchLinks)
                const ins = moves
                  .filter(m => m.party === party && m.product === product && m.direction === 'in')
                  .sort(byDate)
                return (
                  <div key={product} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-700 text-sm">{product}</span>
                      <span className={`text-xs font-bold ${openOut > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {openOut > 0 ? `${openOut} open` : '✓ all returned'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {outs.map(o => (
                        <div key={o.challanNo} className={`rounded-lg border px-3 py-2 ${o.open > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-700">
                              <span className="font-mono text-xs text-blue-600">{o.challanNo}</span>
                              {o.setoff && <span className="ml-1 text-[10px] font-bold text-violet-600">SET-OFF</span>}
                              <span className="text-slate-400"> · OUT {o.qty}</span>
                              <span className="text-slate-400 text-xs"> · {fmtDate(o.date)}</span>
                            </span>
                            <span className={`text-xs font-bold ${o.open > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {o.open > 0 ? `${o.open} open` : 'cleared'}
                            </span>
                          </div>
                          {o.matches.length > 0 && (
                            <div className="mt-1.5 pl-3 border-l-2 border-slate-200 space-y-0.5">
                              {o.matches.map((m, i) => (
                                <div key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                                  <span className="text-emerald-600">↳ IN</span>
                                  <span className="font-mono text-slate-400">{m.challanNo}</span>
                                  {m.pinned && <span className="text-[10px] font-bold text-indigo-600">PINNED</span>}
                                  {m.setoff && <span className="text-[10px] font-bold text-violet-600">SET-OFF</span>}
                                  <span>· {m.qty} pcs · {fmtDate(m.date)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {excessIn > 0 && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                          🚩 {excessIn} pcs received with no matching OUT (excess IN)
                        </div>
                      )}
                    </div>

                    {/* Admin re-link */}
                    {owner && ins.length > 0 && outs.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">Re-link returns (admin)</div>
                        <div className="space-y-1">
                          {ins.map(inm => {
                            const cur = linkFor(party, product, inm.challanNo)
                            return (
                              <div key={inm.challanNo} className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-600">IN</span>
                                <span className="font-mono text-slate-500">{inm.challanNo}</span>
                                <span className="text-slate-400">{inm.quantity} · {fmtDate(inm.date)}</span>
                                <span className="text-slate-300">→</span>
                                <select value={cur} onChange={e => setLink(party, product, inm.challanNo, e.target.value)}
                                  className={`border rounded px-1.5 py-1 text-xs ${cur ? 'border-indigo-300 text-indigo-700 font-semibold' : 'border-slate-300 text-slate-600'}`}>
                                  <option value="">Auto (FIFO)</option>
                                  {outs.map(o => <option key={o.challanNo} value={o.challanNo}>{o.challanNo}</option>)}
                                </select>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
