/**
 * Module Registry — the list of factory modules the app knows about.
 *
 * Adding a future module (Production, Inventory, Dispatch, Billing…) is a
 * one-line change here once the module exports a manifest. The app shell reads
 * this registry; it has no hard-coded knowledge of any specific module.
 */
import { jobworkModule } from './jobwork/manifest'

export const modules = [
  jobworkModule,
  // { future modules go here }
]

/** Look up a module by id. */
export const getModule = (id) => modules.find(m => m.id === id) || modules[0]
