/**
 * Incoming From Welder — queue of plating-bound material the Welder app sent
 * (chrome/gold/rose). Nothing here is a challan yet. Manager/Admin can:
 *   • Accept → creates a real plating OUT challan (atomic number) and links it
 *   • Edit   → adjust party / quantities before accepting
 *   • Reject → marks rejected with a reason (no challan)
 * Link fields (welderChallanNo, linkedChallanId, batchId, sourceApp,
 * destinationApp, parentTransactionId) are carried onto the created challan.
 */
import { useState, useRef } from 'react'
import { Select, useToast, Toast } from '../../../core/ui'
import { fmtDate } from '../../../core/utils/format'
import { claimIncoming, releaseIncoming } from '../../../core/db/firebase'
import { makeId } from '../../../core/db/repository'
import { useJobWork } from '../JobWorkContext'

export default function IncomingFromWelder() {
  const { incoming, parties, setParties, createChallan, log, challans } = useJobWork()
  const toast = useToast()
  const [editing, setEditing] = useState(null)   // id being edited
  const [draftItems, setDraftItems] = useState([])
  const [draftParty, setDraftParty] = useState('')
  const [busy, setBusy] = useState(false)
  // Synchronous lock — blocks a 2nd tap BEFORE React re-renders `busy`, which is
  // what previously let a double-tap create two plating challans for one welder challan.
  const lockRef = useRef(false)

  const list = incoming?.list || []
  const pending = [...list].filter(x => (x.status || 'pending') === 'pending').sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const done = [...list].filter(x => x.status === 'accepted' || x.status === 'rejected').sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 15)

  const partyOpts = (p) => [...new Set([p, ...parties])].filter(Boolean).map(n => ({ value: n, label: n }))

  const startEdit = (it) => { setEditing(it.id); setDraftItems((it.items || []).map(i => ({ ...i }))); setDraftParty(it.party || '') }
  const setQty = (i, v) => setDraftItems(draftItems.map((x, idx) => idx === i ? { ...x, quantity: v } : x))

  const accept = async (it, items, party) => {
    if (lockRef.current || busy) return
    if (!party) return toast.show('Pick a party')
    // ── Anti-duplicate guards ────────────────────────────────────────────────
    // 1) Already handled in this queue.
    if (it.status === 'accepted') return toast.show('Already accepted')
    // 2) A plating challan already exists for this welder challan no — never make
    //    a second one (covers reload / two devices / earlier double-accept). Just
    //    re-link the queue item to the existing challan.
    if (it.welderChallanNo) {
      const existing = challans.list.find(c => c.welderChallanNo === it.welderChallanNo)
      if (existing) {
        incoming.update(it.id, { status: 'accepted', platingChallanNo: existing.challanNo, acceptedAt: new Date().toISOString() })
        setEditing(null)
        return toast.show(`Already in as ${existing.challanNo}`)
      }
    }
    const finalItems = (items || it.items || []).filter(x => x.product && Number(x.quantity) > 0).map(x => ({ product: x.product, quantity: Number(x.quantity) }))
    if (!finalItems.length) return toast.show('No items to accept')
    lockRef.current = true
    setBusy(true)
    // 3) The real guard. Everything above reads THIS device's local copy, so two
    //    phones accepting at the same moment both see "not accepted yet". This
    //    claim runs server-side in a transaction — exactly one device wins.
    const claimId = makeId('clm')
    let claimed = false
    try {
      const claim = await claimIncoming(it.id, claimId)
      if (!claim.ok) {
        setEditing(null)
        if (claim.reason === 'accepted')
          return toast.show(claim.platingChallanNo ? `Already in as ${claim.platingChallanNo}` : 'Already accepted')
        if (claim.reason === 'claimed') return toast.show('Another device is accepting this right now', 3000)
        return toast.show('This challan is no longer in the queue')
      }
      claimed = true

      if (!parties.includes(party)) setParties([...parties, party])
      const challan = await createChallan({
        date: it.date, party, direction: 'out', gaadi: it.gaadi || '',
        items: finalItems,
        welderChallanNo: it.welderChallanNo, linkedChallanId: it.linkedChallanId, batchId: it.batchId,
        sourceApp: it.sourceApp || 'welder', destinationApp: it.destinationApp || 'platingjobwork', parentTransactionId: it.parentTransactionId || '',
      })
      // Awaited: previously fire-and-forget, so a challan could be created while
      // the queue item stayed "pending" and looked un-accepted.
      await incoming.update(it.id, { status: 'accepted', platingChallanNo: challan.challanNo, party, items: finalItems, acceptedAt: new Date().toISOString() })
      log('ACCEPT_INCOMING', `${it.welderChallanNo || ''} → ${challan.challanNo} (${party})`, 'admin')
      toast.show(`Accepted → ${challan.challanNo}`)
      setEditing(null)
    } catch {
      // Hand the claim back so the item isn't locked until the TTL expires.
      if (claimed) { try { await releaseIncoming(it.id, claimId) } catch { /* TTL will clear it */ } }
      toast.show('⚠ Could not accept — check internet & retry', 3500)
    } finally { lockRef.current = false; setBusy(false) }
  }

  const reject = (it) => {
    const reason = prompt(`Reject incoming ${it.welderChallanNo || ''}? Reason:`)
    if (reason === null) return
    if (!reason.trim()) return toast.show('Reason required')
    incoming.update(it.id, { status: 'rejected', rejectReason: reason.trim(), rejectedAt: new Date().toISOString() })
    log('REJECT_INCOMING', `${it.welderChallanNo || ''} rejected · ${reason.trim()}`, 'admin')
    toast.show('Rejected')
  }

  const total = (its) => (its || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <Toast msg={toast.msg} />
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 text-sm text-cyan-800">
          Material sent from the Welder app for plating. <b>Accept</b> to create a plating challan, <b>Edit</b> to adjust first, or <b>Reject</b>.
        </div>

        {pending.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center text-slate-400">No pending incoming material.</div>
        )}

        {pending.map(it => {
          const isEditing = editing === it.id
          return (
            <div key={it.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-700 text-sm"><span className="font-mono text-xs text-blue-600">{it.welderChallanNo}</span> · {isEditing ? '' : it.party}</div>
                  <div className="text-xs text-slate-400">{fmtDate(it.date)}{it.gaadi ? ` · ${it.gaadi}` : ''} · {total(it.items)} pcs</div>
                </div>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded">PENDING</span>
              </div>

              <div className="p-4 space-y-2">
                {isEditing ? (
                  <>
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">Party</span>
                      <Select value={draftParty} onChange={e => setDraftParty(e.target.value)} options={partyOpts(it.party)} className="mt-1" />
                    </div>
                    {draftItems.map((x, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 text-sm text-slate-700">{x.product}</span>
                        <input type="number" value={x.quantity} onChange={e => setQty(i, e.target.value)}
                          className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-center" />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditing(null)} className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-slate-600">Cancel</button>
                      <button disabled={busy} onClick={() => accept(it, draftItems, draftParty)} className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-bold">{busy ? 'Saving…' : 'Accept changes'}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {(it.items || []).map((x, i) => (
                        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-medium">{x.product}: {x.quantity}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button disabled={busy} onClick={() => accept(it, it.items, it.party)} className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-bold">✓ Accept</button>
                      <button onClick={() => startEdit(it)} className="flex-1 border border-slate-300 rounded-lg py-2.5 text-sm font-semibold text-slate-700">✎ Edit</button>
                      <button onClick={() => reject(it)} className="px-4 border border-red-300 text-red-600 rounded-lg py-2.5 text-sm font-semibold">Reject</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}

        {done.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-4">
            <div className="px-4 py-3 border-b border-slate-100"><h3 className="font-bold text-slate-700 text-sm">Recently handled</h3></div>
            <div className="divide-y divide-slate-50">
              {done.map(it => (
                <div key={it.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-400">{it.welderChallanNo}</span> · {it.party}
                    <div className="text-xs text-slate-400">{fmtDate(it.date)} · {total(it.items)} pcs</div>
                  </div>
                  {it.status === 'accepted'
                    ? <span className="text-xs font-semibold text-emerald-600">→ {it.platingChallanNo}</span>
                    : <span className="text-xs font-semibold text-red-500">Rejected</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
