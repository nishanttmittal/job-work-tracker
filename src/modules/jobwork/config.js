/**
 * Plating Job Work module — configuration & constants.
 */

export const APP_TITLE = 'Plating Job Work'

/**
 * ACCESS: two roles via Google sign-in — Manager and Admin (owner).
 *   • Manager → Dashboard, New Challan, Modify, Export (NOT Admin).
 *   • Admin   → everything, including the Admin tab + Users & Access.
 * Roles are assigned in Admin → Users & Access (by email). These bootstrap
 * emails are ALWAYS admin (can never be locked out). Mirror in firestore.rules.
 */
export const OWNER_EMAILS = ['nspenterprises24@gmail.com']
export const ROLES = { owner: 'owner', manager: 'manager' }

/** Quick-add chips on the quantity stepper. */
export const QUICK_QTYS = [10, 25, 50, 100, 200, 500]

/** Default parties / products for a fresh install (editable in-app). */
export const DEFAULT_PARTIES = ['Sriram', 'Jitender']
export const DEFAULT_PRODUCTS = [
  'Spider', 'Beeta', 'Pune', 'Stool', 'Fan',
  '1" Frame', '1.25" Frame', 'Spider 20"', 'Burfi', 'Vista', 'Mona',
]

/** Challan numbering. Format: `${CHALLAN_PREFIX}-0001` (zero-padded, global). */
export const CHALLAN_PREFIX = 'PJW'

/** A challan becomes read-only to normal users this many hours after creation. */
export const EDIT_LOCK_HOURS = 24

/** OUT material pending longer than this many days triggers a reminder. */
export const OUT_REMINDER_DAYS = 7

/**
 * Known product-name aliases for Excel import. When the OUT and IN columns of
 * your register use different wording for the SAME product, map the variant to
 * its canonical name here so imports merge them automatically (instead of
 * splitting into two products). Keys are normalized: lowercase, no spaces.
 */
export const PRODUCT_ALIASES = {
  'framereduce1.5"nickel': 'Frame nickel 1.5"',
}

/** Storage keys owned by this module. */
export const KEYS = {
  challans: 'challans',
  counter:  'challan_counter',
  parties:  'parties',
  products: 'products',
  logs:     'logs',
  lastUsed: 'last_used',
  users:    'users',
}
