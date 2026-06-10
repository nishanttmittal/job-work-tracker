/**
 * Challan helpers — pure functions for numbering, flattening and edit-locking.
 */
import { CHALLAN_PREFIX, EDIT_LOCK_HOURS } from '../config'

/** Format a counter value into a challan number, e.g. 7 -> "PJW-0007". */
export function formatChallanNo(n) {
  return `${CHALLAN_PREFIX}-${String(n).padStart(4, '0')}`
}

/**
 * Flatten challans into individual product movements so the existing balance
 * logic (which works per party+product) can consume them.
 * @returns {Array<{date,party,direction,product,quantity,gaadi,challanNo,createdAt}>}
 */
export function flattenChallans(challans) {
  const out = []
  for (const c of challans) {
    for (const item of c.items || []) {
      out.push({
        date: c.date,
        party: c.party,
        direction: c.direction,
        product: item.product,
        quantity: Number(item.quantity) || 0,
        gaadi: c.gaadi,
        challanNo: c.challanNo,
        createdAt: c.createdAt,
      })
    }
  }
  return out
}

/** Total pieces across a challan's line items. */
export function challanTotalQty(challan) {
  return (challan.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0)
}

/** Is this challan locked for normal-user editing (older than the lock window)? */
export function isLocked(challan, now = Date.now()) {
  if (!challan.createdAt) return false
  const ageMs = now - new Date(challan.createdAt).getTime()
  return ageMs > EDIT_LOCK_HOURS * 3600 * 1000
}

/** Human "x hours/days ago" since an ISO timestamp. */
export function ageLabel(iso, now = Date.now()) {
  if (!iso) return ''
  const ms = now - new Date(iso).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
