/**
 * Excel importer for the legacy job-work register format.
 *
 * Expected layout (one sheet):
 *   • a "section" row containing the words `out` and `in`
 *   • the row directly below it lists product names under each section
 *   • column 0 of every data row is a date (Excel serial or date cell)
 *   • cells hold quantities sent (under OUT) / received (under IN)
 *
 * Each data row becomes up to two challans for the chosen party:
 *   an OUT challan (products with a qty in the OUT columns) and
 *   an IN challan (products with a qty in the IN columns).
 *
 * Product names are matched case-insensitively to existing products so
 * "spider" merges into "Spider" rather than creating a duplicate.
 */
import * as XLSX from 'xlsx'
import { PRODUCT_ALIASES } from '../config'

/** Excel serial / date cell → ISO yyyy-mm-dd (timezone-safe). */
function cellToISO(cell) {
  if (cell instanceof Date) {
    return `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`
  }
  if (typeof cell === 'number' && cell > 1) {
    const d = XLSX.SSF.parse_date_code(cell)
    if (!d || !d.y) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  return null
}

/**
 * Canonicalise a product name. Resolution order:
 *   1. explicit alias map (for OUT/IN headers worded differently),
 *   2. existing product matched ignoring case AND spaces
 *      (e.g. `Spider20"` ↔ `Spider 20"`),
 *   3. otherwise keep the trimmed name as a new product.
 */
function canonical(name, existing, aliases) {
  const t = String(name).replace(/\s+/g, ' ').trim()
  const norm = (s) => s.toLowerCase().replace(/\s+/g, '')
  const nt = norm(t)
  if (aliases && aliases[nt]) return aliases[nt]
  const hit = existing.find(p => norm(p) === nt)
  return hit || t
}

/**
 * Parse a job-work register sheet.
 * @param {ArrayBuffer} buf            file bytes
 * @param {string} party              party these rows belong to
 * @param {string[]} existingProducts current product list (for name matching)
 * @returns {{challans:Array, products:string[], summary:object}}
 */
export function parseJobWorkExcel(buf, party, existingProducts) {
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Locate the OUT/IN section row.
  const eq = (c, v) => String(c).toLowerCase().trim() === v
  const secIdx = rows.findIndex(r => r.some(c => eq(c, 'out')) && r.some(c => eq(c, 'in')))
  if (secIdx < 0) throw new Error('Could not find an "out … in" header row in the sheet.')

  const secRow = rows[secIdx]
  const outCol = secRow.findIndex(c => eq(c, 'out'))
  const inCol  = secRow.findIndex(c => eq(c, 'in'))
  const header = rows[secIdx + 1] || []

  // Build column → product maps for each section (skipping empty headers).
  const productSet = new Set(existingProducts)
  const mapCols = (from, to) => {
    const cols = []
    for (let i = from; i < to; i++) {
      const raw = header[i]
      if (raw !== '' && raw != null) {
        const product = canonical(raw, existingProducts, PRODUCT_ALIASES)
        productSet.add(product)
        cols.push({ i, product })
      }
    }
    return cols
  }
  const outCols = mapCols(outCol, inCol)
  const inCols  = mapCols(inCol, header.length)

  const challans = []
  let outChallans = 0, inChallans = 0, totalPieces = 0
  let minDate = null, maxDate = null

  for (let r = secIdx + 2; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row[0] === '' || row[0] == null) continue
    const date = cellToISO(row[0])
    if (!date) continue
    if (!minDate || date < minDate) minDate = date
    if (!maxDate || date > maxDate) maxDate = date

    const collect = (cols) => {
      const items = []
      for (const { i, product } of cols) {
        const q = Number(row[i])
        if (Number.isFinite(q) && q > 0) { items.push({ product, quantity: q }); totalPieces += q }
      }
      return items
    }
    const outItems = collect(outCols)
    const inItems  = collect(inCols)
    if (outItems.length) { challans.push({ date, party, direction: 'out', gaadi: '', items: outItems }); outChallans++ }
    if (inItems.length)  { challans.push({ date, party, direction: 'in',  gaadi: '', items: inItems  }); inChallans++ }
  }

  return {
    challans,
    products: [...productSet],
    summary: {
      party,
      total: challans.length,
      outChallans, inChallans, totalPieces,
      dateFrom: minDate, dateTo: maxDate,
      newProducts: [...productSet].filter(p => !existingProducts.includes(p)),
    },
  }
}
