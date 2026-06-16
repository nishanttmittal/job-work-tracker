/**
 * New Challan page — one challan, one date/party/direction, MANY products
 * (bulk entry). A unique challan number is auto-assigned on save.
 */
import { useState } from 'react'
import { Card, FieldLabel, Button, Select, TextInput, NumberInput, useToast, Toast } from '../../../core/ui'
import { MONTHS, toISODate, todayStr } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { calcBalance } from '../logic/balance'
import { isFrozenDate } from '../logic/challan'
import { FREEZE_BEFORE } from '../config'

const blankItem = () => ({ product: '', quantity: '' })

export default function NewEntry() {
  const { moves, parties, setParties, products, setProducts, lastUsed, createChallan, peekNextChallanNo } = useJobWork()
  const last = lastUsed.get()
  const now = new Date()
  const toast = useToast()

  const [day, setDay]     = useState(now.getDate())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [showDate, setShowDate] = useState(false)
  const [party, setParty] = useState(parties.includes(last.party) ? last.party : parties[0] || '')
  const [direction, setDirection] = useState(last.direction || 'out')
  const [gaadi, setGaadi] = useState('')
  const [items, setItems] = useState([{ product: products[0] || '', quantity: '' }])

  const [addParty, setAddParty] = useState(false)
  const [newParty, setNewParty] = useState('')
  const [addProd, setAddProd] = useState(false)
  const [newProd, setNewProd] = useState('')

  const years = []
  for (let y = now.getFullYear() + 1; y >= 2023; y--) years.push(y)
  const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1)
  const date = toISODate(day, month, year)
  const isToday = date === todayStr()
  const frozen = isFrozenDate(date)   // pre-June baseline is locked — no back-dating

  // Accurate preview of the unique number that will be assigned on save.
  const nextNoPreview = peekNextChallanNo()

  const setItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it))
  const addItem = () => setItems([...items, blankItem()])
  const removeItem = (i) => items.length > 1 && setItems(items.filter((_, idx) => idx !== i))

  const commitParty = () => {
    const name = newParty.trim()
    if (!name || parties.includes(name)) return
    setParties([...parties, name]); setParty(name); setNewParty(''); setAddParty(false)
  }
  const commitProduct = () => {
    const n = newProd.trim()
    if (!n) return
    // add to the catalogue if new (case/space-insensitive guard)
    const exists = products.find(p => p.toLowerCase().replace(/\s+/g, '') === n.toLowerCase().replace(/\s+/g, ''))
    const canonical = exists || n
    if (!exists) setProducts([...products, n])
    // drop it into the first empty item row, else append a new row
    const emptyIdx = items.findIndex(it => !it.product)
    if (emptyIdx >= 0) setItem(emptyIdx, 'product', canonical)
    else setItems([...items, { product: canonical, quantity: '' }])
    setNewProd(''); setAddProd(false)
  }

  const validItems = items.filter(it => it.product && Number(it.quantity) > 0)
  const canSave = party && validItems.length > 0 && !frozen
  const totalPcs = validItems.reduce((s, it) => s + Number(it.quantity), 0)

  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (frozen) return toast.show(`🔒 Dates before ${FREEZE_BEFORE} are locked (verified history). Pick 1 June or later.`, 3500)
    if (!canSave || saving) return
    setSaving(true)
    try {
      await createChallan({
        date, party, direction, gaadi: gaadi.trim(),
        items: validItems.map(it => ({ product: it.product, quantity: Number(it.quantity) })),
      })
      lastUsed.set({ party, direction })
      setItems([{ product: products[0] || '', quantity: '' }])
      setGaadi('')
      toast.show('✓ Challan Saved!')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Server-issued numbers need a connection; don't clear the form so the
      // user can retry once back online.
      toast.show('⚠ Could not save — check internet & retry', 3500)
    } finally {
      setSaving(false)
    }
  }

  const sel = 'w-full border-2 border-slate-300 rounded-xl px-3 py-3 text-base font-semibold focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-500 bg-white appearance-none'

  return (
    <div className="min-h-screen bg-slate-100 pb-32">
      <Toast msg={toast.msg} />
      <div className="max-w-md mx-auto p-3 space-y-3">

        {/* Challan no preview + Date */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs bg-slate-800 text-white px-2.5 py-1 rounded-full font-bold font-mono">{nextNoPreview}</span>
            <Button variant="ghost" size="sm" className="text-blue-600 bg-blue-50" onClick={() => setShowDate(!showDate)}>
              {showDate ? 'Done' : 'Change Date'}
            </Button>
          </div>
          <FieldLabel>Date</FieldLabel>
          <div className="text-lg font-bold text-slate-800 mt-0.5">
            {String(day).padStart(2,'0')} {MONTHS[month-1]} {year}
            {isToday && <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold align-middle">TODAY</span>}
          </div>
          {showDate && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Select value={day} onChange={e => setDay(+e.target.value)} options={days.map(String)} className={sel} />
              <Select value={month} onChange={e => setMonth(+e.target.value)} options={MONTHS.map((m, i) => ({ value: i + 1, label: m.slice(0,3) }))} className={sel} />
              <Select value={year} onChange={e => setYear(+e.target.value)} options={years.map(String)} className={sel} />
            </div>
          )}
          {frozen && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 font-semibold">
              🔒 Locked — data before {FREEZE_BEFORE} is the verified history and can't be added or back-dated. Choose 1 June 2026 or later.
            </div>
          )}
        </Card>

        {/* Direction */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setDirection('out')}
            className={`py-5 rounded-2xl font-bold text-lg transition-all ${direction === 'out' ? 'bg-blue-600 text-white shadow-lg shadow-blue-300 scale-105' : 'bg-white text-slate-400 shadow-sm'}`}>
            ↗ OUT<div className="text-xs font-medium mt-0.5 opacity-80">Sent for plating</div>
          </button>
          <button onClick={() => setDirection('in')}
            className={`py-5 rounded-2xl font-bold text-lg transition-all ${direction === 'in' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-300 scale-105' : 'bg-white text-slate-400 shadow-sm'}`}>
            ↙ IN<div className="text-xs font-medium mt-0.5 opacity-80">Received back</div>
          </button>
        </div>

        {/* Party */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <FieldLabel>Party</FieldLabel>
            <button onClick={() => setAddParty(!addParty)} className="text-blue-600 text-sm font-bold">{addParty ? 'Cancel' : '+ New Party'}</button>
          </div>
          {addParty ? (
            <div className="flex gap-2">
              <TextInput value={newParty} autoFocus placeholder="New party name" onChange={e => setNewParty(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitParty()} />
              <Button onClick={commitParty} className="px-6">Add</Button>
            </div>
          ) : (
            <Select value={party} onChange={e => setParty(e.target.value)} options={parties} className={sel} />
          )}
        </Card>

        {/* Products (bulk line items) */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <FieldLabel>Products in this Challan</FieldLabel>
            <button onClick={() => setAddProd(!addProd)} className="text-blue-600 text-sm font-bold">{addProd ? 'Cancel' : '+ New Product'}</button>
          </div>
          {addProd && (
            <div className="flex gap-2 mb-3">
              <TextInput value={newProd} autoFocus placeholder="New product name"
                onChange={e => setNewProd(e.target.value)} onKeyDown={e => e.key === 'Enter' && commitProduct()} />
              <Button onClick={commitProduct} className="px-6">Add</Button>
            </div>
          )}
          <div className="flex justify-end mb-2">
            <span className="text-xs text-slate-400 font-semibold">{validItems.length} item(s) · {totalPcs} pcs</span>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => {
              const bal = it.product ? calcBalance(moves, party, it.product, date) : null
              return (
                <div key={i}>
                  <div className="flex gap-2 items-center">
                    <Select value={it.product} onChange={e => setItem(i, 'product', e.target.value)}
                      options={['', ...products].map(p => ({ value: p, label: p || 'Select product…' }))}
                      className={`${sel} flex-1 min-w-0 !text-lg`} />
                    <NumberInput value={it.quantity} placeholder="Qty" onChange={e => setItem(i, 'quantity', e.target.value)}
                      className="!w-20 !px-2 flex-shrink-0 text-center !py-3" />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 text-xl font-bold flex-shrink-0">×</button>
                    )}
                  </div>
                  {bal && (bal.out > 0 || bal.in > 0) && (
                    <div className={`text-xs mt-1 ml-1 font-semibold ${bal.balance < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {bal.balance < 0 ? '🚩 ' : ''}{it.product} pending at {party}: {bal.balance} pcs
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button onClick={addItem} className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 font-bold text-sm active:bg-blue-50">
            + Add Another Product
          </button>
        </Card>

        {/* Gaadi */}
        <Card className="p-4">
          <FieldLabel>Gaadi Number <span className="text-slate-300 font-normal normal-case">(optional)</span></FieldLabel>
          <TextInput value={gaadi} inputMode="numeric" placeholder="1234"
            className="mt-2 !w-32 text-center text-xl tracking-[0.3em] font-bold"
            onChange={e => setGaadi(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 no-print">
        <div className="max-w-md mx-auto">
          <Button onClick={save} disabled={!canSave || saving} variant={direction === 'out' ? 'primary' : 'success'} size="lg" className="w-full">
            {saving ? 'Saving…' : `💾 Save Challan ${totalPcs > 0 ? `· ${totalPcs} pcs` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
