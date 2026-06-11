/**
 * PDF generation + native share (WhatsApp). Builds a real PDF with jsPDF and
 * shares it through the device share sheet (iPhone/Android → WhatsApp). Falls
 * back to download on desktop where file-sharing isn't available.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, todayStr } from '../../../core/utils/format'
import { partyBalances } from './balance'
import { APP_TITLE } from '../config'

const PURPLE = [109, 40, 217]

function header(doc, title, party, sub) {
  doc.setFontSize(16); doc.setTextColor(...PURPLE); doc.setFont(undefined, 'bold')
  doc.text(APP_TITLE, 40, 40)
  doc.setFontSize(13); doc.setTextColor(30, 41, 59)
  doc.text(title, 40, 60)
  doc.setFontSize(11); doc.text(`Party: ${party}`, 40, 78)
  doc.setFontSize(9); doc.setTextColor(100, 116, 139); doc.setFont(undefined, 'normal')
  doc.text(sub, 40, 92)
}

const DIR_LABEL = { out: 'Sent (OUT)', in: 'Received (IN)', both: 'All Movements (IN + OUT)' }

/**
 * Build a date-wise PIVOT PDF: one COLUMN per product, one ROW per date, cells =
 * pieces. A TOTAL row at the bottom sums each product across all dates (+ grand
 * total), and a Total column sums each date across products. Filterable by
 * party / product / date range and direction ('out' | 'in' | 'both').
 */
export function buildDateWisePdf(moves, { party = 'all', product = 'all', from = '', to = '', direction = 'both' } = {}) {
  const rows = moves
    .filter(m => party === 'all' || m.party === party)
    .filter(m => product === 'all' || m.product === product)
    .filter(m => (!from || m.date >= from) && (!to || m.date <= to))
    .filter(m => direction === 'both' || m.direction === direction)

  const dates = [...new Set(rows.map(m => m.date))].sort()
  // With many products, keep the top columns by volume and roll the rest into an
  // "Others" column so the report stays readable on one page width.
  const MAX_COLS = 14
  const allProducts = [...new Set(rows.map(m => m.product))]
  let cols, othersSet = null
  if (allProducts.length > MAX_COLS) {
    const ranked = allProducts
      .map(p => ({ p, t: rows.reduce((s, m) => s + (m.product === p ? m.quantity : 0), 0) }))
      .sort((a, b) => b.t - a.t)
    cols = ranked.slice(0, MAX_COLS - 1).map(x => x.p).sort()
    othersSet = new Set(ranked.slice(MAX_COLS - 1).map(x => x.p))
  } else {
    cols = allProducts.sort()
  }
  const colKey = (p) => (othersSet && othersSet.has(p) ? 'Others' : p)
  const displayCols = othersSet ? [...cols, 'Others'] : cols
  const cell = {}            // cell[date][col] = pcs
  for (const m of rows) {
    const k = colKey(m.product)
    ;(cell[m.date] = cell[m.date] || {})[k] = (cell[m.date]?.[k] || 0) + m.quantity
  }
  const colTotal = (c) => rows.reduce((s, m) => s + (colKey(m.product) === c ? m.quantity : 0), 0)
  const grand = rows.reduce((s, m) => s + m.quantity, 0)

  // Many products → landscape so the columns fit.
  const doc = new jsPDF(displayCols.length > 6 ? 'l' : 'p', 'pt', 'a4')
  header(doc, `Date-wise Report — ${DIR_LABEL[direction]}`,
    `${party === 'all' ? 'All Parties' : party}${product === 'all' ? '' : ` · ${product}`}${othersSet ? ` · top ${MAX_COLS - 1} products + Others` : ''}`,
    `Period: ${from ? fmtDate(from) : 'Beginning'} to ${fmtDate(to)} · Generated ${fmtDate(todayStr())}`)
  autoTable(doc, {
    startY: 108,
    head: [['Date', ...displayCols, 'Total']],
    body: dates.map(d => {
      const vals = displayCols.map(c => cell[d]?.[c] || 0)
      const rowTotal = vals.reduce((s, v) => s + v, 0)
      return [fmtDate(d), ...vals.map(v => v || ''), rowTotal]
    }),
    foot: [['TOTAL', ...displayCols.map(c => colTotal(c)), grand]],
    headStyles: { fillColor: PURPLE },
    footStyles: { fillColor: [237, 233, 254], textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: displayCols.length > 8 ? 7 : 9, halign: 'center' },
    columnStyles: { 0: { halign: 'left' } },
  })
  return doc
}

/** Build a balance-summary PDF as of a date. */
export function buildBalancePdf(moves, party, products, asOf) {
  const data = partyBalances(moves, party, products, asOf)
  const doc = new jsPDF('p', 'pt', 'a4')
  header(doc, 'Balance Material Report', party, `As of ${fmtDate(asOf)} · Generated ${fmtDate(todayStr())}`)
  autoTable(doc, {
    startY: 108,
    head: [['Product', 'Sent', 'Received', 'Pending']],
    body: data.map(d => [
      d.product, d.out, d.in,
      d.balance > 0 ? `${d.balance} pending` : d.balance < 0 ? `${Math.abs(d.balance)} excess` : 'Clear',
    ]),
    foot: [['TOTAL', data.reduce((s, d) => s + d.out, 0), data.reduce((s, d) => s + d.in, 0),
            `${data.reduce((s, d) => s + d.balance, 0)} pending`]],
    headStyles: { fillColor: PURPLE },
    footStyles: { fillColor: [237, 233, 254], textColor: 20 },
    styles: { fontSize: 9 },
  })
  return doc
}

/**
 * Share a jsPDF document: tries the native share sheet with the PDF file
 * (WhatsApp etc. on mobile); falls back to download on desktop.
 */
export async function sharePdf(doc, filename) {
  const blob = doc.output('blob')
  const file = new File([blob], filename, { type: 'application/pdf' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled'
    }
  }
  // Fallback: download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
