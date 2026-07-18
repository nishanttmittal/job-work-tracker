/**
 * Admin — Admin-role only (enforced by manifest roles + AuthGate). Provides:
 *  • Reconciliation: edit ANY challan (even locked) with a mandatory reason
 *  • Audit Logs: full action history
 *  • Rename products (cascades into challan line items)
 *  • Delete by date range · Backup/Restore · Reset all
 */
import { useState, useMemo } from 'react'
import { SearchBar, Select, DateInput, useToast, Toast } from '../../../core/ui'
import { fmtDate, todayStr } from '../../../core/utils/format'
import { useJobWork } from '../JobWorkContext'
import { challanTotalQty, isHistoryFrozen } from '../logic/challan'
import { parseJobWorkExcel } from '../logic/excelImport'
import ChallanEditor from '../components/ChallanEditor'
import { OWNER_EMAILS, FREEZE_BEFORE } from '../config'

// Access is enforced by role: this whole tab is Admin-only (see manifest roles).
export default function Admin() {
  return <AdminPanel />
}

function AdminPanel() {
  const { challans, logs, parties, setParties, products, setProducts, log, moves, createChallan } = useJobWork()
  const toast = useToast()
  const [tab, setTab] = useState('reconcile')

  const tabs = [
    { k: 'reconcile', t: '🔧 Reconcile' },
    { k: 'setoff', t: '⚖️ Set-off' },
    { k: 'import', t: '📥 Import' },
    { k: 'logs', t: '📜 Logs' },
    { k: 'manage', t: '⚙️ Manage' },
    { k: 'users', t: '👥 Users' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <Toast msg={toast.msg} />
      <div className="bg-white border-b border-slate-200 px-4 py-2 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex gap-2">
          {tabs.map(x => (
            <button key={x.k} onClick={() => setTab(x.k)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === x.k ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>{x.t}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {tab === 'reconcile' && <Reconcile challans={challans} parties={parties} products={products} log={log} toast={toast} />}
        {tab === 'setoff' && <SetOff parties={parties} products={products} moves={moves} createChallan={createChallan} log={log} toast={toast} />}
        {tab === 'import' && <ImportExcel parties={parties} toast={toast} />}
        {tab === 'logs' && <Logs logs={logs} />}
        {tab === 'manage' && <Manage challans={challans} logs={logs} parties={parties} setParties={setParties} products={products} setProducts={setProducts} log={log} toast={toast} />}
        {tab === 'users' && <ManageUsers />}
      </div>
    </div>
  )
}

/* ── Users & Access: assign Manager / Admin by Google email ───────────────── */
function ManageUsers() {
  const { users, log } = useJobWork()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('manager')

  const add = () => {
    const e = email.trim().toLowerCase()
    if (!e.includes('@')) return toast.show('Enter a valid email')
    if (users.list.some(u => (u.email || '').toLowerCase() === e)) return toast.show('Already added')
    users.insert({ id: e, email: e, name: name.trim(), role, active: true })
    log('USER_ADD', `${e} as ${role}`, 'admin'); toast.show('User added'); setEmail(''); setName('')
  }
  const toggleActive = (u) => { const on = u.active !== false; users.update(u.id, { active: !on }); log(on ? 'USER_OFF' : 'USER_ON', u.email, 'admin') }
  const setRoleFor = (u, r) => { users.update(u.id, { role: r }); log('USER_ROLE', `${u.email} → ${r}`, 'admin') }
  const remove = (u) => { if (confirm(`Remove ${u.email}? They lose access.`)) { users.remove(u.id); log('USER_DEL', u.email, 'admin') } }

  const inp = 'border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
      <Toast msg={toast.msg} />
      <h3 className="font-bold text-slate-700 text-sm">Users &amp; Access ({users.list.length})</h3>
      <p className="text-xs text-slate-400">Managers &amp; Admins sign in with Google. Add their Google email and choose a role.</p>
      {OWNER_EMAILS.length > 0 && <p className="text-[11px] text-emerald-600">Built-in admin (always allowed): {OWNER_EMAILS.join(', ')}</p>}
      <input className={`${inp} w-full`} placeholder="email@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
      <div className="flex gap-2">
        <input className={`${inp} flex-1`} placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} />
        <Select value={role} onChange={e => setRole(e.target.value)} options={[{ value: 'manager', label: 'Manager' }, { value: 'owner', label: 'Admin' }]} />
        <button onClick={add} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">Add</button>
      </div>
      <div className="space-y-2">
        {users.list.length === 0 && <p className="text-sm text-slate-400">No users added yet.</p>}
        {[...users.list].sort((a, b) => (a.email || '').localeCompare(b.email || '')).map(u => (
          <div key={u.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold truncate ${u.active === false ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{u.name || u.email}</div>
              <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
            </div>
            <Select value={u.role || 'manager'} onChange={e => setRoleFor(u, e.target.value)} options={[{ value: 'manager', label: 'Manager' }, { value: 'owner', label: 'Admin' }]} />
            <button onClick={() => toggleActive(u)} className={`text-xs font-bold px-2 py-1 rounded-lg ${u.active === false ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>{u.active === false ? 'Off' : 'On'}</button>
            <button onClick={() => remove(u)} className="text-red-500 font-bold px-1">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Reconciliation: edit any challan with a mandatory reason ────────────── */
function Reconcile({ challans, parties, products, log, toast }) {
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const q = search.trim().toLowerCase()
  const matched = challans.list
    .filter(c => !q || (c.challanNo || '').toLowerCase().includes(q) || c.party.toLowerCase().includes(q) || (c.items || []).some(it => it.product.toLowerCase().includes(q)) || fmtDate(c.date).includes(q) || (c.date || '').includes(q))
    .filter(c => !dateFilter || c.date === dateFilter)
    .sort((a, b) => (b.date || '').localeCompare(a.date))
  const rows = matched.slice(0, 50)

  const save = (updated, reason) => {
    challans.update(updated.id, { ...updated, reconciled: true, reconcileReason: reason })
    log('RECONCILE', `${updated.challanNo} reconciled — ${reason}`, 'admin')
    toast.show('Challan reconciled & logged')
    setEditing(null)
  }

  const del = (c) => {
    if (isHistoryFrozen(c)) return toast.show(`🔒 ${c.challanNo} is locked history (before ${FREEZE_BEFORE}). To correct it, use Edit (Reconcile) with a reason.`, 4000)
    if (!confirm(`Delete challan ${c.challanNo}?\n\n${c.party} · ${c.direction.toUpperCase()} · ${fmtDate(c.date)} · ${challanTotalQty(c)} pcs\n\nThis permanently removes it and changes the balance. Cannot be undone.`)) return
    challans.remove(c.id)
    log('DELETE', `${c.challanNo} deleted (${c.party}, ${c.direction.toUpperCase()}, ${challanTotalQty(c)} pcs)${c.welderChallanNo ? ' [welder ' + c.welderChallanNo + ']' : ''}`, 'admin')
    toast.show(`Deleted ${c.challanNo}`)
  }

  // Duplicate detector — challans that share the same welder challan number
  // (the exact bug that double-counted material). Each extra can be deleted here.
  const dupGroups = useMemo(() => {
    const by = {}
    challans.list.forEach(c => { if (c.welderChallanNo) (by[c.welderChallanNo] || (by[c.welderChallanNo] = [])).push(c) })
    return Object.entries(by)
      .filter(([, arr]) => arr.length > 1)
      .map(([wno, arr]) => [wno, [...arr].sort((a, b) => (a.challanNo || '').localeCompare(b.challanNo || ''))])
  }, [challans.list])

  return (
    <div className="space-y-3">
      <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
        Edit any challan (including locked ones). A reason is required and recorded in the audit log. Use <b>Delete</b> to remove a single wrong or duplicate challan.
      </div>

      {dupGroups.length > 0 && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 space-y-3">
          <div className="text-sm font-bold text-red-700">⚠ Duplicate challans found ({dupGroups.length})</div>
          <p className="text-xs text-red-600 -mt-1">Same welder challan accepted more than once. Keep one, delete the extras.</p>
          {dupGroups.map(([wno, arr]) => (
            <div key={wno} className="bg-white rounded-lg border border-red-200 p-2">
              <div className="text-xs font-semibold text-slate-500 mb-1">Welder challan <span className="font-mono text-blue-600">{wno}</span> · {arr.length} copies</div>
              {arr.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className="flex-1 min-w-0 truncate">
                    <span className="font-mono text-xs text-slate-400">{c.challanNo}</span> · {c.party} · {c.direction.toUpperCase()} · {challanTotalQty(c)} pcs
                  </span>
                  {i === 0
                    ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">KEEP</span>
                    : <button onClick={() => del(c)} className="text-xs font-bold bg-red-600 text-white px-3 py-1 rounded">Delete</button>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Find by no, party, product or date…" />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-500">📅 By date</span>
        <DateInput value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        {dateFilter && <button onClick={() => setDateFilter('')} className="text-xs font-semibold text-violet-600 underline">clear</button>}
        <span className="text-xs text-slate-400 ml-auto">
          {matched.length} match{matched.length === 1 ? '' : 'es'}{matched.length > 50 ? ' · showing latest 50 — pick a date to narrow' : ''}
        </span>
      </div>
      {rows.map(c => (
        <div key={c.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {editing === c.id ? (
            <ChallanEditor challan={c} parties={parties} products={products} requireReason onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${c.direction === 'out' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.direction === 'out' ? 'OUT' : 'IN'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-700">
                  <span className="font-mono text-xs text-slate-400">{c.challanNo}</span> · {c.party}
                  {isHistoryFrozen(c) && <span className="ml-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">🔒 HISTORY</span>}
                </div>
                <div className="text-xs text-slate-400">{fmtDate(c.date)} · {(c.items || []).length} item(s) · {challanTotalQty(c)} pcs</div>
              </div>
              <button onClick={() => setEditing(c.id)} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold">Edit</button>
              {!isHistoryFrozen(c) && <button onClick={() => del(c)} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-semibold">Delete</button>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Set-off: admin adjustment — post an IN or OUT movement to fix a balance ── */
function SetOff({ parties, products, moves, createChallan, log, toast }) {
  const [party, setParty] = useState(parties[0] || '')
  const [product, setProduct] = useState(products[0] || '')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [dirOverride, setDirOverride] = useState('')   // '' = auto from balance
  const [busy, setBusy] = useState(false)

  // Live balance for the selected party+product (out − in, incl. prior set-offs).
  const balance = moves.reduce((s, m) =>
    m.party === party && m.product === product ? s + (m.direction === 'out' ? m.quantity : -m.quantity) : s, 0)
  const pending = balance > 0, excess = balance < 0
  const max = Math.abs(balance)
  const amount = Number(qty) || 0
  // Default direction clears the imbalance (pending → post IN, excess → post OUT).
  const direction = dirOverride || (excess ? 'out' : 'in')
  const projected = balance + (direction === 'out' ? amount : -amount)

  const apply = async () => {
    if (busy) return
    if (!party || !product) return toast.show('Pick party & product')
    if (!(amount > 0)) return toast.show('Enter a quantity')
    if (!reason.trim()) return toast.show('Reason is required')
    setBusy(true)
    try {
      const c = await createChallan({
        date: todayStr(), party, direction, gaadi: '',
        items: [{ product, quantity: amount }],
        setoff: true, reconciled: true, reconcileReason: reason.trim(),
      })
      log('SETOFF', `${party} · ${product} · ${amount} (${direction.toUpperCase()}) → ${c.challanNo} — ${reason.trim()}`, 'admin')
      toast.show(`Set off ${amount} pcs (${direction.toUpperCase()}) → ${c.challanNo}`)
      setQty(''); setReason(''); setDirOverride('')
    } catch {
      toast.show('⚠ Could not set off — check internet & retry', 3500)
    } finally { setBusy(false) }
  }

  const dirBtn = (d, label) => (
    <button onClick={() => setDirOverride(d)}
      className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${direction === d
        ? (d === 'in' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white')
        : 'bg-slate-100 text-slate-500'}`}>{label}</button>
  )

  return (
    <div className="space-y-3">
      <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-700">
        Post an adjustment to fix a balance — <b>Post IN</b> (clears pending / records a return) or <b>Post OUT</b> (clears excess / records extra sent). It's a tracked set-off movement (excluded from real sent/received totals) and is logged. Reason is mandatory.
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Party</span>
            <Select value={party} onChange={e => setParty(e.target.value)} options={parties} className="mt-1" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Material</span>
            <Select value={product} onChange={e => setProduct(e.target.value)} options={products} className="mt-1" />
          </div>
        </div>

        <div className={`rounded-xl px-4 py-3 text-center font-bold ${
          pending ? 'bg-amber-50 text-amber-700' : excess ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {pending ? `${max} pcs pending` : excess ? `${max} pcs excess (IN > OUT)` : '✓ Balance is clear'}
        </div>

        <div className="flex gap-2">
          {dirBtn('in', '↙ Post IN')}
          {dirBtn('out', '↗ Post OUT')}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 flex-1">Quantity</span>
          <input type="number" inputMode="numeric" value={qty} placeholder={max ? String(max) : '0'}
            onChange={e => setQty(e.target.value)}
            className="w-28 border-2 border-slate-300 rounded-xl px-3 py-2 text-base font-semibold text-center" />
          {max > 0 && <button onClick={() => setQty(String(max))} className="text-xs font-bold text-violet-600 px-2">All</button>}
        </div>

        {amount > 0 && (
          <div className="text-xs text-center text-slate-500">
            Balance after set-off:{' '}
            <span className={`font-bold ${projected > 0 ? 'text-amber-600' : projected < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {projected > 0 ? `${projected} pending` : projected < 0 ? `${Math.abs(projected)} excess` : 'Clear'}
            </span>
          </div>
        )}

        <input type="text" value={reason} placeholder="Reason (required) — e.g. scrapped at plater"
          onChange={e => setReason(e.target.value)}
          className="w-full border-2 border-slate-300 rounded-xl px-3 py-2 text-sm" />
        <button disabled={busy} onClick={apply}
          className="w-full bg-violet-600 text-white rounded-xl py-3 font-bold text-sm disabled:opacity-50">
          {busy ? 'Setting off…' : `Set off ${amount > 0 ? amount + ' pcs ' : ''}(${direction.toUpperCase()})`}
        </button>
      </div>
    </div>
  )
}

/* ── Import from Excel ───────────────────────────────────────────────────── */
function ImportExcel({ parties, toast }) {
  const { products, setProducts, importChallans } = useJobWork()
  const [party, setParty] = useState(parties[0] || '')
  const [preview, setPreview] = useState(null)   // { challans, products, summary }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onFile = async (ev) => {
    const file = ev.target.files?.[0]; ev.target.value = ''
    if (!file) return
    setError(''); setPreview(null); setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const result = parseJobWorkExcel(buf, party, products)
      if (result.challans.length === 0) throw new Error('No data rows found in the sheet.')
      setPreview(result)
    } catch (e) {
      setError(e.message)
    } finally { setBusy(false) }
  }

  const [importing, setImporting] = useState(false)
  const doImport = async () => {
    if (!preview || importing) return
    // History freeze: never re-import pre-June rows (they'd duplicate the locked baseline).
    const frozenRows = preview.challans.filter(c => (c.date || '') < FREEZE_BEFORE).length
    if (frozenRows) {
      toast.show(`🔒 ${frozenRows} row(s) are before ${FREEZE_BEFORE} — that history is locked and won't be re-imported. Trim the sheet to 1 June onward.`, 5000)
      return
    }
    setImporting(true)
    try {
      // add any new products discovered
      const merged = [...new Set([...products, ...preview.products])]
      if (merged.length !== products.length) setProducts(merged)
      const n = await importChallans(preview.challans)
      toast.show(`Imported ${n} challans for ${party}`)
      setPreview(null)
    } catch (e) {
      toast.show('⚠ Import failed — check internet & retry', 3500)
    } finally {
      setImporting(false)
    }
  }

  const s = preview?.summary

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
        Upload your monthly Excel register (date rows · OUT / IN product columns). Each row becomes OUT and/or IN challans for the selected party.
      </div>

      {/* Party + file */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Party for this file</span>
          <Select value={party} onChange={e => { setParty(e.target.value); setPreview(null) }} options={parties} className="mt-1.5" />
        </div>
        <label className="block w-full bg-blue-600 text-white rounded-xl py-3 text-sm font-bold text-center cursor-pointer">
          {busy ? 'Reading…' : '📁 Choose Excel File (.xlsx)'}
          <input type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" disabled={busy} />
        </label>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</div>}
      </div>

      {/* Preview */}
      {s && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 overflow-hidden">
          <div className="bg-emerald-600 text-white px-4 py-3 font-bold text-sm">Preview — ready to import</div>
          <div className="p-4 space-y-2 text-sm">
            <Row k="Party" v={s.party} />
            <Row k="Total challans" v={`${s.total}  (${s.outChallans} OUT · ${s.inChallans} IN)`} />
            <Row k="Total pieces" v={`${s.totalPieces} pcs`} />
            <Row k="Date range" v={`${fmtDate(s.dateFrom)} → ${fmtDate(s.dateTo)}`} />
            {s.newProducts.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1">New products to be added:</div>
                <div className="flex flex-wrap gap-1.5">
                  {s.newProducts.map(p => <span key={p} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg font-medium">{p}</span>)}
                </div>
              </div>
            )}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <button onClick={() => setPreview(null)} className="flex-1 border border-slate-300 rounded-xl py-2.5 text-sm text-slate-600">Cancel</button>
            <button onClick={doImport} className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold">✓ Import {s.total} Challans</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }) {
  return <div className="flex justify-between"><span className="text-slate-400">{k}</span><span className="font-semibold text-slate-700">{v}</span></div>
}

/* ── Audit logs ──────────────────────────────────────────────────────────── */
function Logs({ logs }) {
  const rows = [...logs.list].sort((a, b) => (b.ts || '').localeCompare(a.ts || '')).slice(0, 200)
  const color = { CREATE: 'text-emerald-600', EDIT: 'text-blue-600', DELETE: 'text-red-600', RECONCILE: 'text-violet-600', RESET: 'text-red-700' }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100"><h3 className="font-bold text-slate-700 text-sm">Audit Log ({logs.list.length})</h3></div>
      {rows.length === 0 ? <div className="px-4 py-8 text-center text-slate-400 text-sm">No activity yet</div> : (
        <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto">
          {rows.map(l => (
            <div key={l.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className={`text-xs font-bold w-20 flex-shrink-0 ${color[l.action] || 'text-slate-500'}`}>{l.action}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-700">{l.detail}</div>
                <div className="text-xs text-slate-400">{new Date(l.ts).toLocaleString('en-IN')} · {l.by}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Manage: products, delete-range, backup/restore, reset ───────────────── */
function Manage({ challans, logs, parties, setParties, products, setProducts, log, toast }) {
  const [editingProduct, setEditingProduct] = useState(null)
  const [editName, setEditName] = useState('')
  const [delFrom, setDelFrom] = useState('')
  const [delTo, setDelTo] = useState('')
  const [dirF, setDirF] = useState('all')
  const [partyF, setPartyF] = useState('all')
  const [prodF, setProdF] = useState('all')
  const [confirmReset, setConfirmReset] = useState(false)
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('pjw:lastBackup'))
  const [nowTs] = useState(() => Date.now())

  const matchDel = (c) =>
    !isHistoryFrozen(c)   // never range-delete the locked pre-June baseline
    && (!delFrom || c.date >= delFrom) && (!delTo || c.date <= delTo)
    && (dirF === 'all' || c.direction === dirF)
    && (partyF === 'all' || c.party === partyF)
    && (prodF === 'all' || (c.items || []).some(it => it.product === prodF))
  const delMatches = challans.list.filter(matchDel)

  const renameProduct = (oldName) => {
    const name = editName.trim()
    if (!name || products.includes(name)) { setEditingProduct(null); return }
    setProducts(products.map(p => p === oldName ? name : p))
    // cascade into challan line items
    let n = 0
    challans.list.forEach(c => {
      if ((c.items || []).some(it => it.product === oldName)) {
        challans.update(c.id, { items: c.items.map(it => it.product === oldName ? { ...it, product: name } : it) })
        n++
      }
    })
    log('EDIT', `Product "${oldName}" → "${name}" (${n} challans)`, 'admin')
    setEditingProduct(null)
    toast.show(`Renamed in ${n} challans`)
  }

  const deleteRange = () => {
    if (!delMatches.length) return toast.show('No challans match these filters')
    if (!confirm(`Delete ${delMatches.length} matching challan${delMatches.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    const n = challans.removeWhere(matchDel)
    const f = [delFrom && `from ${fmtDate(delFrom)}`, delTo && `to ${fmtDate(delTo)}`, dirF !== 'all' && dirF.toUpperCase(), partyF !== 'all' && partyF, prodF !== 'all' && prodF].filter(Boolean).join(', ') || 'all'
    log('DELETE', `${n} challans deleted (${f})`, 'admin')
    toast.show(`Deleted ${n} challans`)
    setDelFrom(''); setDelTo(''); setDirF('all'); setPartyF('all'); setProdF('all')
  }

  const downloadBackup = () => {
    const backup = { version: 2, exportedAt: new Date().toISOString(), challans: challans.list, parties, products, logs: logs.list }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `platingjobwork-backup-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
    const ts = new Date().toISOString(); localStorage.setItem('pjw:lastBackup', ts); setLastBackup(ts)
    toast.show(`Backup downloaded — ${challans.list.length} challans`)
  }

  const restoreBackup = (ev) => {
    const file = ev.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!Array.isArray(data.challans)) throw new Error('Invalid backup file')
        // typed confirm (fix 2026-07-18): restore replaces EVERYTHING — it must never run on a stray file-pick
        if (prompt(`Restore will REPLACE all ${challans.list.length} current challans with "${file.name}" (${data.challans.length} challans).\nType RESTORE to continue:`) !== 'RESTORE') { toast.show('Restore cancelled'); return }
        challans.replaceAll(data.challans)
        if (Array.isArray(data.parties) && data.parties.length) setParties(data.parties)
        if (Array.isArray(data.products) && data.products.length) setProducts(data.products)
        log('EDIT', `Restored backup (${data.challans.length} challans)`, 'admin')
        toast.show(`Restored ${data.challans.length} challans`)
      } catch (err) { toast.show('❌ ' + err.message) }
    }
    reader.readAsText(file); ev.target.value = ''
  }

  const doReset = () => { challans.reset(); log('RESET', 'All challans reset', 'admin'); setConfirmReset(false); toast.show('All data reset') }

  return (
    <>
      {/* Rename products */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-700 text-sm">Rename Products</h3>
          <p className="text-xs text-slate-400 mt-0.5">Updates all challan line items too</p>
        </div>
        <div className="divide-y divide-slate-50">
          {products.map(p => (
            <div key={p} className="px-4 py-2.5 flex items-center gap-2">
              {editingProduct === p ? (
                <>
                  <input value={editName} autoFocus onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameProduct(p)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  <button onClick={() => renameProduct(p)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold">Save</button>
                  <button onClick={() => setEditingProduct(null)} className="px-3 py-1.5 text-slate-500 text-xs">Cancel</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-700">{p}</span>
                  <button onClick={() => { setEditingProduct(p); setEditName(p) }} className="text-blue-600 text-xs font-semibold">Rename</button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete (filtered) */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-1">Delete Challans (filtered)</h3>
        <p className="text-xs text-slate-400 mb-3">Date range + direction / party / product, then delete the matching challans.</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><span className="text-xs text-slate-500 block mb-1">From</span>
            <input type="date" value={delFrom} onChange={e => setDelFrom(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" /></div>
          <div><span className="text-xs text-slate-500 block mb-1">To</span>
            <input type="date" value={delTo} onChange={e => setDelTo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" /></div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Select value={dirF} onChange={e => setDirF(e.target.value)} options={[{ value: 'all', label: 'IN & OUT' }, { value: 'out', label: 'Outgoing' }, { value: 'in', label: 'Incoming' }]} />
          <Select value={partyF} onChange={e => setPartyF(e.target.value)} options={[{ value: 'all', label: 'All parties' }, ...parties.map(p => ({ value: p, label: p }))]} />
          <Select value={prodF} onChange={e => setProdF(e.target.value)} options={[{ value: 'all', label: 'All products' }, ...products.map(p => ({ value: p, label: p }))]} />
        </div>
        <button onClick={deleteRange} disabled={!delMatches.length} className={`w-full px-4 py-2.5 rounded-lg text-sm font-bold ${!delMatches.length ? 'bg-slate-200 text-slate-400' : 'bg-red-600 text-white'}`}>Delete {delMatches.length} matching challan{delMatches.length === 1 ? '' : 's'}</button>
      </div>

      {/* Backup */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-1">Backup & Restore</h3>
        <p className="text-xs text-slate-400 mb-3">Save everything to a file, or restore from a backup</p>
        {(() => {
          const days = lastBackup ? Math.floor((nowTs - new Date(lastBackup).getTime()) / 86400000) : null
          const stale = days === null || days >= 7
          return (
            <div className={`rounded-xl px-3 py-2 mb-3 text-xs font-semibold ${stale ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {lastBackup
                ? `Last backup: ${days === 0 ? 'today' : days + ' day' + (days === 1 ? '' : 's') + ' ago'}${stale ? ' — please back up now' : ' ✓'}`
                : '⚠ No backup yet on this device — please download one now'}
            </div>
          )
        })()}
        <div className="flex gap-2">
          <button onClick={downloadBackup} className="flex-1 bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold">⬇ Download Backup</button>
          <label className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center cursor-pointer">⬆ Restore
            <input type="file" accept="application/json,.json" onChange={restoreBackup} className="hidden" /></label>
        </div>
      </div>

      {/* Danger */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-red-200 p-4">
        <h3 className="font-bold text-red-700 text-sm mb-1">⚠ Danger Zone</h3>
        <p className="text-xs text-slate-400 mb-3">Permanently deletes ALL challans</p>
        {confirmReset ? (
          <div className="space-y-2">
            <p className="text-sm text-red-700 font-medium">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 border border-slate-300 rounded-lg py-2 text-sm text-slate-600">Cancel</button>
              <button onClick={doReset} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-bold">Yes, Reset</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="w-full border-2 border-red-300 text-red-600 rounded-lg py-2.5 text-sm font-semibold">Reset All Challans</button>
        )}
      </div>
    </>
  )
}
