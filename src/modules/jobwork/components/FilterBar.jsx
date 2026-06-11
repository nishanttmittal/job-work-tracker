/**
 * FilterBar — shared party / material / date-range selector. Controlled:
 * pass `value` ({ party, product, from, to }) and `onChange`.
 */
import { Select, DateInput } from '../../../core/ui'

export default function FilterBar({ parties, products, value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v })
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 no-print">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase">Party</span>
          <Select value={value.party} onChange={e => set('party', e.target.value)} className="mt-1"
            options={[{ value: 'all', label: 'All Parties' }, ...parties.map(p => ({ value: p, label: p }))]} />
        </div>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase">Material</span>
          <Select value={value.product} onChange={e => set('product', e.target.value)} className="mt-1"
            options={[{ value: 'all', label: 'All Materials' }, ...products.map(p => ({ value: p, label: p }))]} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><span className="text-xs text-slate-500 block mb-1">From</span><DateInput value={value.from} onChange={e => set('from', e.target.value)} /></div>
        <div><span className="text-xs text-slate-500 block mb-1">To</span><DateInput value={value.to} onChange={e => set('to', e.target.value)} /></div>
      </div>
    </div>
  )
}
