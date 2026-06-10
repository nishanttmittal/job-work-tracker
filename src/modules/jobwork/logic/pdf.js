/**
 * PDF generation + native share (WhatsApp). Builds a real PDF with jsPDF and
 * shares it through the device share sheet (iPhone/Android → WhatsApp). Falls
 * back to download on desktop where file-sharing isn't available.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, todayStr } from '../../../core/utils/format'
import { calcBalance, partyBalances } from './balance'
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

/** Build a date-wise transactions PDF (one row per challan line item). */
export function buildDateWisePdf(moves, party, from, to) {
  const rows = moves
    .filter(m => m.party === party)
    .filter(m => (!from || m.date >= from) && (!to || m.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date))
  const doc = new jsPDF('p', 'pt', 'a4')
  header(doc, 'Date-wise Transaction Report', party,
    `Period: ${from ? fmtDate(from) : 'Beginning'} to ${fmtDate(to)} · Generated ${fmtDate(todayStr())}`)
  autoTable(doc, {
    startY: 108,
    head: [['Challan', 'Date', 'Product', 'Dir', 'Qty', 'Gaadi']],
    body: rows.map(m => [m.challanNo, fmtDate(m.date), m.product, m.direction.toUpperCase(), m.quantity, m.gaadi || '—']),
    headStyles: { fillColor: PURPLE },
    styles: { fontSize: 9 },
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
