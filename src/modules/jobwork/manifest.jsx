/**
 * Job Work — module manifest.
 *
 * This is the contract every factory module implements so the app shell can
 * mount it generically. To add a NEW factory module later (e.g. Production,
 * Inventory, Dispatch): create a folder under modules/, export a manifest with
 * the same shape, and register it in modules/registry.js. No shell changes.
 *
 * Shape:
 *   id        unique string
 *   title     display name
 *   icon      emoji/short glyph
 *   Provider  React context provider wrapping the module's pages (state)
 *   HomeStats optional component shown on the module home (uses module state)
 *   pages[]   { key, title, desc, icon, color, Component }
 */
import { JobWorkProvider } from './JobWorkContext'
import { useJobWork } from './JobWorkContext'
import Dashboard from './pages/Dashboard'
import NewEntry from './pages/NewEntry'
import ModifyEntry from './pages/ModifyEntry'
import IncomingFromWelder from './pages/IncomingFromWelder'
import Matching from './pages/Matching'
import Reports from './pages/Reports'
import Export from './pages/Export'
import Admin from './pages/Admin'

/** Small stats strip for the module home screen — Admin only. */
function HomeStats({ owner }) {
  const { challans } = useJobWork()
  if (!owner) return null
  const m = new Date().getMonth(), y = new Date().getFullYear()
  const thisMonth = challans.list.filter(c => {
    const d = new Date(c.date); return d.getMonth() === m && d.getFullYear() === y
  }).length
  const stat = (n, l) => (
    <div className="bg-white/10 rounded-xl px-4 py-2.5 flex-1 text-center">
      <div className="text-2xl font-bold">{n}</div>
      <div className="text-xs text-slate-400 mt-0.5">{l}</div>
    </div>
  )
  return (
    <div className="mt-4 flex gap-3">
      {stat(challans.list.length, 'Challans')}
      {stat(new Set(challans.list.map(c => c.party)).size, 'Active Parties')}
      {stat(thisMonth, 'This Month')}
    </div>
  )
}

export const jobworkModule = {
  id: 'jobwork',
  title: 'Plating Job Work',
  icon: '🏭',
  Provider: JobWorkProvider,
  HomeStats,
  // roles: who sees the card. Manager + Admin run daily ops; Admin tab is
  // Admin-only (reconcile, import, delete/reset, backup, manage, users).
  pages: [
    { key: 'dashboard', title: 'Dashboard',      desc: 'Party-wise pending, alerts & reminders',  icon: '📊', color: 'from-blue-600 to-blue-700',     roles: ['manager', 'owner'], Component: Dashboard },
    { key: 'newEntry',  title: 'New Challan',     desc: 'Bulk multi-product OUT / IN entry',       icon: '➕', color: 'from-emerald-600 to-emerald-700', roles: ['manager', 'owner'], Component: NewEntry },
    { key: 'incoming',  title: 'Incoming From Welder', desc: 'Accept material sent for plating',    icon: '📥', color: 'from-cyan-600 to-cyan-700',     roles: ['manager', 'owner'], Component: IncomingFromWelder },
    { key: 'matching',  title: 'Matching',        desc: 'Challan-to-challan FIFO matching',        icon: '🔗', color: 'from-teal-600 to-teal-700',     roles: ['manager', 'owner'], Component: Matching },
    { key: 'modify',    title: 'Modify Challans', desc: 'Search & edit recent challans',           icon: '✏️', color: 'from-amber-500 to-amber-600',     roles: ['manager', 'owner'], Component: ModifyEntry },
    { key: 'export',    title: 'Export / Share',  desc: 'Share PDF report on WhatsApp',            icon: '📄', color: 'from-violet-600 to-violet-700',   roles: ['manager', 'owner'], Component: Export },
    { key: 'reports',   title: 'Reports',         desc: 'Date / party / material totals',          icon: '📈', color: 'from-indigo-600 to-indigo-700',   roles: ['owner'], Component: Reports },
    { key: 'admin',     title: 'Admin',           desc: 'Reconcile, set-off, import, users, backup', icon: '⚙️', color: 'from-slate-600 to-slate-700',   roles: ['owner'], Component: Admin },
  ],
}
