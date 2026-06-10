/**
 * App root.
 * Runs version-safe data migrations exactly once on boot (before any page
 * reads storage), then mounts the app shell for the default factory module.
 */
import { useState } from 'react'
import { runMigrations } from './core/db/migrations'
import AppShell from './app/AppShell'

// Run migrations synchronously at module load, before React renders, so every
// repository read below sees data already at the current schema version.
runMigrations()

export default function App() {
  // Default to the first registered module. (A module-picker could live here
  // once more than one factory module is registered.)
  const [moduleId] = useState('jobwork')
  return <AppShell moduleId={moduleId} />
}
