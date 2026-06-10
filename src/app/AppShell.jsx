/**
 * AppShell — mounts the module inside its state Provider, behind Google sign-in.
 * Two roles: Manager and Admin (owner). Manager sees all pages except Admin;
 * Admin sees everything. Pages are filtered from the manifest by role.
 * Offline test mode (?local=1, no cloud) bypasses auth with full access.
 */
import { useState } from 'react'
import { getModule } from '../modules/registry'
import { isFirebaseConfigured } from '../core/db/firebaseConfig'
import ModuleHome from './ModuleHome'
import NavBar from './NavBar'
import AuthGate from './AuthGate'

function Console({ module, role, onSwitch, userEmail }) {
  const [activeKey, setActiveKey] = useState(null)
  const pages = module.pages.filter(p => !p.roles || p.roles.includes(role))
  const view = { ...module, pages }
  const activePage = pages.find(p => p.key === activeKey)
  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {activePage ? (
        <>
          <NavBar title={activePage.title} onHome={() => setActiveKey(null)} />
          <activePage.Component role={role} owner={role === 'owner'} />
        </>
      ) : (
        <ModuleHome module={view} onOpen={setActiveKey} />
      )}
      {onSwitch && (
        <div className="fixed bottom-0 inset-x-0 bg-slate-900 text-slate-300 px-4 flex items-center justify-between text-xs no-print z-30"
          style={{ paddingTop: '0.5rem', paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          <span className="font-semibold tracking-wide uppercase truncate">{role === 'owner' ? 'Admin' : 'Manager'}{userEmail ? ` · ${userEmail}` : ''}</span>
          <button onClick={onSwitch} className="bg-white/15 rounded-lg px-3 py-1.5 font-bold flex-shrink-0">Sign out</button>
        </div>
      )}
    </div>
  )
}

export default function AppShell({ moduleId }) {
  const module = getModule(moduleId)
  const { Provider } = module

  // Offline test mode (?local=1): no cloud, no auth — full access for testing.
  if (!isFirebaseConfigured) {
    return <Provider><Console module={module} role="owner" /></Provider>
  }

  return (
    <Provider>
      <AuthGate title={module.title} icon={module.icon}>
        {({ role, email, signOut }) => <Console module={module} role={role} onSwitch={signOut} userEmail={email} />}
      </AuthGate>
    </Provider>
  )
}
