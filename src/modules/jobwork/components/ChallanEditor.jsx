/**
 * ChallanEditor — shared inline editor for a challan (party, direction, date,
 * gaadi + product line items). Reused by Modify (within 24h) and Admin
 * reconciliation (any time). When `requireReason` is set, a mandatory reason
 * must be entered before saving (used for audited admin reconciliation).
 */
import { useState } from 'react'
import { Select } from '../../../core/ui'

export default function ChallanEditor({ challan, parties, products, requireReason = false, onSave, onCancel }) {
  const [draft, setDraft] = useState({
    ...challan,
    items: (challan.items || []).map(it => ({ ...it })),
  })
  const [reason, setReason] = useState('')

  const set = (field, val) => setDraft({ ...draft, [field]: val })
  const setItem = (i, field, val) => setDraft({ ...draft, items: draft.items.map((it, idx) => idx === i ? { ...it, [field]: val } : it) })
  const addItem = () => setDraft({ ...draft, items: [...draft.items, { product: products[0] || '', quantity: '' }] })
  const removeItem = (i) => draft.items.length > 1 && setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) })

  const valid = draft.items.filter(it => it.product && Number(it.quantity) > 0)
  const canSave = draft.party && valid.length > 0 && (!requireReason || reason.trim())

  const cell = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'

  return (
    <div className="p-4 space-y-3 bg-amber-50">
      <div className="text-xs font-mono font-bold text-slate-500">{draft.challanNo}</div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={draft.party} onChange={e => set('party', e.target.value)} options={parties} className={cell} />
        <Select value={draft.direction} onChange={e => set('direction', e.target.value)} className={cell}
          options={[{ value: 'out', label: 'Outgoing' }, { value: 'in', label: 'Incoming' }]} />
        <input type="date" value={draft.date} onChange={e => set('date', e.target.value)} className={cell} />
        <input type="text" value={draft.gaadi} onChange={e => set('gaadi', e.target.value.toUpperCase())} className={cell} placeholder="Gaadi No" />
      </div>

      <div className="space-y-2">
        {draft.items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Select value={it.product} onChange={e => setItem(i, 'product', e.target.value)} options={products} className={`${cell} flex-1`} />
            <input type="number" value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} className={`${cell} w-20 text-center`} placeholder="Qty" />
            {draft.items.length > 1 && <button onClick={() => removeItem(i)} className="w-8 h-8 rounded-lg bg-red-100 text-red-600 font-bold">×</button>}
          </div>
        ))}
        <button onClick={addItem} className="text-xs text-blue-600 font-bold">+ Add product</button>
      </div>

      {requireReason && (
        <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for change (required)"
          className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-slate-600">Cancel</button>
        <button onClick={() => onSave({ ...draft, items: valid.map(it => ({ product: it.product, quantity: Number(it.quantity) })) }, reason.trim())}
          disabled={!canSave}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold ${canSave ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
          Save Changes
        </button>
      </div>
    </div>
  )
}
