/**
 * Movement filtering — shared by Matching, Reports and Export so the
 * party / material / date-range selection behaves identically everywhere.
 */

export const EMPTY_FILTER = { party: 'all', product: 'all', from: '', to: '' }

/** Filter flattened movements by party, product and inclusive date range. */
export function filterMoves(moves, f = EMPTY_FILTER) {
  const { party = 'all', product = 'all', from = '', to = '' } = f || {}
  return moves.filter(m =>
    (party === 'all' || m.party === party) &&
    (product === 'all' || m.product === product) &&
    (!from || m.date >= from) &&
    (!to || m.date <= to))
}
