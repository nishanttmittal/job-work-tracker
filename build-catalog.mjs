/**
 * UNICO shared catalogue importer (Phase 1 — run AFTER Saturday's CorelDRAW export).
 *
 * Builds the dedicated shared catalogue at Firestore `apps/catalog/products`
 * (one doc per product, doc id = real UNICO code), which both the welder and
 * plating apps will read as the canonical product identity.
 *
 * Usage:
 *   node build-catalog.mjs <export.csv>            # DRY RUN — validates, writes nothing
 *   node build-catalog.mjs <export.csv> --commit   # writes apps/catalog/products/{code}
 *
 * export.csv columns (case-insensitive; extra columns are kept verbatim):
 *   code      (required, unique) — real UNICO code, becomes the doc id / product id
 *   name      (required)         — canonical product name
 *   category  (optional)
 *   image     (optional)         — URL or storage path
 *
 * NOTE before --commit: add a Firestore rule for the new path, e.g.
 *   match /apps/catalog/{c}/{d} { allow read: if request.auth != null;
 *                                 allow write: if isOwner(); }
 */
import { readFileSync } from 'fs'

const canon = (s) => String(s ?? '').replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'").replace(/\s+/g, ' ').trim()

function parseCSV(t) {
  t = t.replace(/^﻿/, '')
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < t.length; i++) { const c = t[i]
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else { if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = '' } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = '' } else if (c !== '\r') cur += c }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row) }
  const head = rows.shift().map(h => h.trim().toLowerCase())
  return rows.filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

const file = process.argv[2]
const commit = process.argv.includes('--commit')
if (!file) { console.error('Usage: node build-catalog.mjs <export.csv> [--commit]'); process.exit(1) }

const raw = parseCSV(readFileSync(file, 'utf8'))
const docs = []
const errors = []
const seen = new Map()
for (const [i, r] of raw.entries()) {
  const code = (r.code || r.sku || '').trim()
  const name = canon(r.name || r.product_name || '')
  if (!code) { errors.push(`row ${i + 2}: missing code (name="${name}")`); continue }
  if (!name) { errors.push(`row ${i + 2}: missing name (code=${code})`); continue }
  if (seen.has(code)) { errors.push(`row ${i + 2}: duplicate code ${code} (also row ${seen.get(code)})`); continue }
  seen.set(code, i + 2)
  docs.push({ id: code, code, name, category: canon(r.category || ''), image: (r.image || r.photo || '').trim(),
    nameKey: name.toLowerCase(), updatedAt: new Date().toISOString() })
}

console.log(`Parsed ${raw.length} rows → ${docs.length} valid catalogue products, ${errors.length} problem(s).`)
if (errors.length) { console.log('\nPROBLEMS (fix these in the export):'); errors.slice(0, 40).forEach(e => console.log('  ✗ ' + e)) }
console.log('\nSample:'); docs.slice(0, 5).forEach(d => console.log(`  ${d.code}  ${d.name}${d.category ? '  ['+d.category+']' : ''}${d.image ? '  (img)' : ''}`))

if (!commit) { console.log('\nDRY RUN — nothing written. Re-run with --commit (and the Firestore rule in place) to publish.'); process.exit(0) }
if (errors.length) { console.error('\nRefusing to commit while there are problems. Fix the export and re-run.'); process.exit(1) }

const { initializeApp } = await import('firebase/app')
const { getAuth, signInAnonymously } = await import('firebase/auth')
const { getFirestore, doc, writeBatch } = await import('firebase/firestore')
const cfg = { apiKey: 'AIzaSyCK0M-EfmOp9nh1-ZJcrBqT7c4plNxL2FM', authDomain: 'unico-operations.firebaseapp.com', projectId: 'unico-operations', storageBucket: 'unico-operations.firebasestorage.app', messagingSenderId: '367786260524', appId: '1:367786260524:web:ae49d5da0ef1a71a9e3989' }
const app = initializeApp(cfg); const db = getFirestore(app); await signInAnonymously(getAuth(app))
let n = 0, batch = writeBatch(db)
for (const d of docs) { batch.set(doc(db, 'apps', 'catalog', 'products', d.code), d); if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db) } }
await batch.commit()
console.log(`\n✓ Committed ${docs.length} products to apps/catalog/products.`)
process.exit(0)
