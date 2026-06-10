import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

console.log('\n=== DASHBOARD VIEW FILTER ===\n')
await step('Load dashboard (real cloud)', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
  await page.click('text=Dashboard')
  await page.waitForSelector('text=Party-wise Pending Material', { timeout: 12000 })
  await page.waitForTimeout(2000)
})

// count occurrences of a party name in the page (the filter button is always 1)
const count = (name) => page.evaluate((n) => (document.body.innerText.match(new RegExp(n, 'g')) || []).length, name)
// click the filter-bar button specifically (first match = the chip in the View row)
const clickFilter = (label) => page.locator('button', { hasText: new RegExp('^' + label + '$') }).first().click()

let allSri, allJit
await step('All Parties view shows BOTH (multiple mentions each)', async () => {
  allSri = await count('Sriram'); allJit = await count('Jitender')
  if (allSri < 2 || allJit < 2) throw new Error(`expected both with content, Sriram=${allSri} Jitender=${allJit}`)
})

await step('Filter → Sriram: Jitender drops to button-only', async () => {
  await clickFilter('Sriram')
  await page.waitForTimeout(800)
  const sri = await count('Sriram'), jit = await count('Jitender')
  console.log(`   Sriram view → Sriram=${sri}, Jitender=${jit}`)
  if (jit !== 1) throw new Error(`Jitender content still shown (count ${jit}, expected 1 = button only)`)
  if (sri < 2) throw new Error('Sriram content disappeared')
})

await step('Filter → Jitender: Sriram drops to button-only', async () => {
  await clickFilter('Jitender')
  await page.waitForTimeout(800)
  const sri = await count('Sriram'), jit = await count('Jitender')
  console.log(`   Jitender view → Sriram=${sri}, Jitender=${jit}`)
  if (sri !== 1) throw new Error(`Sriram content still shown (count ${sri}, expected 1)`)
  if (jit < 2) throw new Error('Jitender content disappeared')
})

await step('Back to All shows both again', async () => {
  await clickFilter('All Parties')
  await page.waitForTimeout(800)
  if (await count('Sriram') < 2 || await count('Jitender') < 2) throw new Error('All view broken')
})
await page.screenshot({ path: 'test-shots/filter.png', fullPage: true })

await b.close()
console.log('\n' + (errors.length === 0 ? '✅ FILTER WORKS across whole dashboard' : '❌ ' + errors.join('\n  ')))
