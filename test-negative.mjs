import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

console.log('\n=== NEGATIVE QUANTITY ON DASHBOARD ===\n')
await step('Load dashboard (real cloud)', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
  await page.click('text=Dashboard')
  await page.waitForSelector('text=Party-wise Pending Material', { timeout: 12000 })
  await page.waitForTimeout(2000)
})

await step('Negative balances render (excess in red)', async () => {
  const txt = await page.evaluate(() => document.body.innerText)
  // negative numbers in the party-wise breakdown chips, e.g. "Fan: -20"
  const negChip = /:\s*-\d+/.test(txt)
  const hasExcess = txt.includes('excess')
  console.log('   negative chip present:', negChip, '| "excess" label present:', hasExcess)
  if (!negChip && !hasExcess) throw new Error('no negative balances shown (real data may have none net)')
})
await page.screenshot({ path: 'test-shots/negative.png', fullPage: true })

await b.close()
console.log('\n' + (errors.length === 0 ? '✅ negatives display on dashboard' : '❌ ' + errors.join('\n  ')))
