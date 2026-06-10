/**
 * Plating Job Work — balance & aging logic (pure).
 * Operates on flattened movements (see logic/challan.flattenChallans).
 */
import { OUT_REMINDER_DAYS } from '../config'

/** OUT/IN/balance for a party+product, optionally as of a date. */
export function calcBalance(moves, party, product, asOfDate = null) {
  let out = 0, inn = 0
  for (const m of moves) {
    if (m.party !== party || m.product !== product) continue
    if (asOfDate && m.date > asOfDate) continue
    if (m.direction === 'out') out += Number(m.quantity)
    else inn += Number(m.quantity)
  }
  return { out, in: inn, balance: out - inn }
}

/** (party,product) pairs where IN exceeds OUT — red-flag alerts. */
export function findRedFlags(moves, parties, products) {
  const flags = []
  for (const party of parties) {
    for (const product of products) {
      const { out, in: inn } = calcBalance(moves, party, product)
      if (inn > out && (out > 0 || inn > 0)) flags.push({ party, product, out, in: inn, excess: inn - out })
    }
  }
  return flags
}

/** Per-product balance rows for one party (only products with activity). */
export function partyBalances(moves, party, products, asOfDate = null) {
  return products
    .map(product => ({ product, ...calcBalance(moves, party, product, asOfDate) }))
    .filter(d => d.out > 0 || d.in > 0)
}

/**
 * Party-wise net pending summary for the dashboard.
 * Includes a product-name-wise breakdown of EVERY non-zero balance per party —
 * positive = pending (still out), negative = excess (more received than sent).
 * `pending` is the net (can be negative).
 * @returns {Array<{party, pending, items, breakdown:Array<{product,balance}>}>}
 */
export function partyWisePending(moves, parties, products) {
  return parties.map(party => {
    const rows = partyBalances(moves, party, products)
    const breakdown = rows
      .filter(r => r.balance !== 0)
      .map(r => ({ product: r.product, balance: r.balance }))
      .sort((a, b) => b.balance - a.balance)
    const pending = breakdown.reduce((s, r) => s + r.balance, 0)
    return { party, pending, items: breakdown.length, breakdown }
  })
}

/**
 * Aging reminder: party+product pending for longer than OUT_REMINDER_DAYS,
 * measured from the OLDEST outstanding OUT movement date for that pair.
 * @returns {Array<{party,product,pending,ageDays,since}>}
 */
export function findAgingOut(moves, parties, products, days = OUT_REMINDER_DAYS) {
  const today = new Date()
  const out = []
  for (const party of parties) {
    for (const product of products) {
      const { balance } = calcBalance(moves, party, product)
      if (balance <= 0) continue
      // oldest OUT date for this pair
      const outDates = moves
        .filter(m => m.party === party && m.product === product && m.direction === 'out')
        .map(m => m.date)
        .sort()
      if (!outDates.length) continue
      const since = outDates[0]
      const ageDays = Math.floor((today - new Date(since + 'T00:00:00')) / 86400000)
      if (ageDays >= days) out.push({ party, product, pending: balance, ageDays, since })
    }
  }
  return out.sort((a, b) => b.ageDays - a.ageDays)
}
