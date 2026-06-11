/**
 * Export — generate a report and share it as a PDF (WhatsApp on mobile) or
 * download it on desktop. Two report types: date-wise transactions & balance
 * summary, per party.
 */
import { useState } from 'react'
import { Select, DateInput, useToast, Toast } from '../../../core/ui'
import { todayStr } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { buildDateWisePdf, buildBalancePdf, sharePdf } from '../logic/pdf'

export default function Export() {
  const { moves, parties, products } = useJobWork()
  const toast = useToast()
  const [type, setType] = useState('datewise')
  const [party, setParty] = useState('all')
  const [product, setProduct] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayStr())
  const [asOf, setAsOf] = useState(todayStr())
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    if (type === 'balance' && party === 'all') return toast.show('Pick a party for the balance report')
    setBusy(true)
    try {
      const doc = type === 'datewise'
        ? buildDateWisePdf(moves, party, from, to, product)
        : buildBalancePdf(moves, party, products, asOf)
      const safeParty = party === 'all' ? 'all-parties' : party
      const name = `${safeParty}-${type === 'datewise' ? 'transactions' : 'balance'}-${todayStr()}.pdf`
      const result = await sharePdf(doc, name)
      toast.show(result === 'shared' ? 'Shared!' : result === 'downloaded' ? 'PDF downloaded' : 'Cancelled')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <Toast msg={toast.msg} />
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Report Type</span>
          <div className="grid gap-2 mt-2">
            {[
              { v: 'datewise', t: '📅 Date-wise Transactions', d: 'All products & movements within a date range' },
              { v: 'balance', t: '⚖️ Balance Summary', d: 'Pending material per product as of a date' },
            ].map(o => (
              <button key={o.v} onClick={() => setType(o.v)}
                className={`p-4 rounded-xl text-left ${type === o.v ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-slate-100 text-slate-600'}`}>
                <div className="font-bold text-sm">{o.t}</div>
                <div className={`text-xs mt-0.5 ${type === o.v ? 'text-violet-100' : 'text-slate-400'}`}>{o.d}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div><span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Party</span>
            <Select value={party} onChange={e => setParty(e.target.value)} className="mt-2"
              options={[{ value: 'all', label: 'All Parties' }, ...parties.map(p => ({ value: p, label: p }))]} /></div>
          {type === 'datewise' && (
            <div><span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Material</span>
              <Select value={product} onChange={e => setProduct(e.target.value)} className="mt-2"
                options={[{ value: 'all', label: 'All Materials' }, ...products.map(p => ({ value: p, label: p }))]} /></div>
          )}
          {type === 'datewise' ? (
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-slate-500 block mb-1">From</span><DateInput value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><span className="text-xs text-slate-500 block mb-1">To</span><DateInput value={to} onChange={e => setTo(e.target.value)} /></div>
            </div>
          ) : (
            <div><span className="text-xs text-slate-500 block mb-1">Balance as of</span><DateInput value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
          )}
        </div>

        <button onClick={generate} disabled={busy || !party}
          className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg flex items-center justify-center gap-2 ${busy || !party ? 'bg-slate-300 text-slate-400' : 'bg-green-600 text-white shadow-green-200'}`}>
          {busy ? 'Preparing…' : '📤 Share PDF (WhatsApp)'}
        </button>
        <p className="text-xs text-slate-400 text-center">On phone: opens share sheet → choose WhatsApp. On desktop: downloads the PDF.</p>
      </div>
    </div>
  )
}
