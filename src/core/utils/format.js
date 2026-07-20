/**
 * Formatting & date helpers — pure, dependency-free, shared by all modules.
 */

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/* The factory runs on India time, so "today" must mean today IN INDIA — never
   the server's or browser's timezone. en-CA formats as YYYY-MM-DD directly. */
const IST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
})

/** ISO yyyy-mm-dd for today, in Asia/Kolkata.
 *
 *  FIXED 2026-07-20 (owner: entries belong to the real calendar day).
 *  Was `new Date().toISOString().slice(0,10)`, which is UTC — between 00:00 and
 *  05:29 IST that returned YESTERDAY. That didn't just mis-date entries: because
 *  screens validate with `date > todayStr()` and cap pickers with
 *  `max={todayStr()}`, an early-morning entry for the real today was rejected as
 *  "Future date not allowed". Existing records are NOT rewritten — old
 *  early-morning entries keep the date they were saved with. */
export const todayStr = () => IST_DATE.format(new Date())

/** ISO yyyy-mm-dd for N days before today, in Asia/Kolkata.
 *  Anchored at noon UTC so adding/subtracting days can never slip a day at a
 *  timezone boundary. */
export const daysAgoStr = (n) => {
  const d = new Date(todayStr() + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** ISO yyyy-mm-dd from day/month/year numbers. */
export const toISODate = (d, m, y) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** dd/mm/yyyy for display. */
export const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Indian-format rupee/number, rounded to whole. */
export const fmtNum = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN')

/**
 * Canonicalise a product name so the SAME physical product always matches as one
 * string across apps. The welder app emits curly inch/foot marks (e.g. 17”)
 * while this app uses straight quotes (17"); without this they'd be treated as
 * two different products and balances would never net. Folds curly quotes to
 * straight and collapses whitespace. Case is preserved (names are case-sensitive
 * across the UNICO apps). Pure, dependency-free.
 */
export const normalizeProductName = (s) =>
  String(s ?? '')
    .replace(/[“”″]/g, '"')   // “ ” ″  → "
    .replace(/[‘’′]/g, "'")   // ‘ ’ ′  → '
    .replace(/\s+/g, ' ')
    .trim()
