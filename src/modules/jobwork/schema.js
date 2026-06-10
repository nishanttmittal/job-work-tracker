/**
 * Plating Job Work — Challan record schema.
 *
 * A CHALLAN is one document: a unique number, a single date/party/direction,
 * and one-or-more product line items (bulk entry). This list is the source of
 * truth for the challan's top-level fields.
 *
 * ➕ To add a new challan field later (e.g. "Transporter", "Remarks"): add one
 *    field() below. Old challans keep working because the normalizer fills the
 *    new field's default on read.
 *
 * Line items are an array of { product, quantity } — managed by the entry form.
 */
import { field } from '../../core/schema/field'
import { todayStr } from '../../core/utils/format'

export const challanSchema = [
  field({ name: 'challanNo', label: 'Challan No', type: 'text', default: '', required: true }),
  field({ name: 'date',      label: 'Date',       type: 'date', default: todayStr, required: true }),
  field({ name: 'party',     label: 'Party',      type: 'select', required: true }),
  field({ name: 'direction', label: 'Direction',  type: 'select', default: 'out', required: true,
          options: [{ value: 'out', label: 'Outgoing' }, { value: 'in', label: 'Incoming' }] }),
  field({ name: 'gaadi',     label: 'Gaadi No',   type: 'text', default: '', required: false }),
  // items: [{ product, quantity }] — not a scalar field, handled by the form.
  field({ name: 'items',     label: 'Items',      type: 'list', default: () => [], required: true }),
  // Reconciliation metadata (set only when admin edits/reconciles).
  field({ name: 'reconciled',     label: 'Reconciled',  type: 'toggle', default: false }),
  field({ name: 'reconcileReason', label: 'Reason',     type: 'text',   default: '' }),
]

/**
 * App user for role-based access (Google sign-in). Doc id = lowercased email so
 * Firestore rules can look the role up directly. Admin manages these in
 * Admin → Users & Access. role: 'owner' (admin) | 'manager'.
 */
export const userSchema = [
  field({ name: 'email',  label: 'Email',  type: 'text',   default: '', required: true }),
  field({ name: 'name',   label: 'Name',   type: 'text',   default: '' }),
  field({ name: 'role',   label: 'Role',   type: 'text',   default: 'manager' }),
  field({ name: 'active', label: 'Active', type: 'toggle', default: true }),
]

/**
 * "Incoming From Welder" queue item — written by the Welder app when chrome/gold/
 * rose material is sent. NOT a challan: a Manager/Admin Accepts it (→ creates a
 * plating challan), Edits, or Rejects. Link fields are preserved for traceability.
 * status: 'pending' | 'accepted' | 'rejected'.
 */
export const incomingSchema = [
  field({ name: 'status',          label: 'Status',     type: 'text', default: 'pending' }),
  field({ name: 'date',            label: 'Date',       type: 'date', default: todayStr }),
  field({ name: 'party',           label: 'Party',      type: 'text', default: '' }),
  field({ name: 'gaadi',           label: 'Gaadi',      type: 'text', default: '' }),
  field({ name: 'items',           label: 'Items',      type: 'list', default: () => [] }),
  field({ name: 'welderChallanNo', label: 'Welder Challan', type: 'text', default: '' }),
  field({ name: 'linkedChallanId', label: 'Linked',     type: 'text', default: '' }),
  field({ name: 'batchId',         label: 'Batch',      type: 'text', default: '' }),
  field({ name: 'sourceApp',       label: 'Source',     type: 'text', default: '' }),
  field({ name: 'destinationApp',  label: 'Destination', type: 'text', default: '' }),
  field({ name: 'parentTransactionId', label: 'Parent', type: 'text', default: '' }),
  field({ name: 'platingChallanNo', label: 'Plating Challan', type: 'text', default: '' }),
  field({ name: 'rejectReason',    label: 'Reject reason', type: 'text', default: '' }),
]
