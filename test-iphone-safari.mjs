// Test the LIVE deployed site with WebKit (Safari engine) + iPhone profile.
import { webkit, devices } from 'playwright'
const LIVE = 'https://nishanttmittal.github.io/job-work-tracker/'
const errors = []
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }
const count = (n) => page.evaluate((x) => (document.body.innerText.match(new RegExp(x, 'g')) || []).length, n)
const clickFilter = (label) => page.locator('button', { hasText: new RegExp('^' + label + '$') }).first().click()

console.log('\n=== iPHONE SAFARI (WebKit) — LIVE SITE FILTER TEST ===\n')

await step('LIVE site loads + connects to cloud', async () => {
  await page.goto(LIVE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 25000 })
})

await step('Cloud data shows on iPhone Safari', async () => {
  await page.click('text=Dashboard')
  await page.waitForSelector('text=Party-wise Pending Material', { timeout: 15000 })
  await page.waitForTimeout(2500)
  if (await count('Sriram') < 2 || await count('Jitender') < 2) throw new Error('cloud data not visible')
})

await step('Tap Sriram → filters whole dashboard', async () => {
  await clickFilter('Sriram')
  await page.waitForTimeout(1000)
  const sri = await count('Sriram'), jit = await count('Jitender')
  console.log(`   Sriram view → Sriram=${sri}, Jitender=${jit}`)
  if (jit !== 1) throw new Error(`Jitender content still showing (${jit})`)
})

await step('Tap Jitender → filters whole dashboard', async () => {
  await clickFilter('Jitender')
  await page.waitForTimeout(1000)
  const sri = await count('Sriram'), jit = await count('Jitender')
  console.log(`   Jitender view → Sriram=${sri}, Jitender=${jit}`)
  if (sri !== 1) throw new Error(`Sriram content still showing (${sri})`)
})

await step('Tap All Parties → both return', async () => {
  await clickFilter('All Parties')
  await page.waitForTimeout(1000)
  if (await count('Sriram') < 2 || await count('Jitender') < 2) throw new Error('All view broken')
})

// confirm the live JS is the new build (filter applies dashboard-wide)
await step('Spider 20" shows balance 0 (data fix is live)', async () => {
  await clickFilter('Sriram'); await page.waitForTimeout(800)
  const txt = await page.evaluate(() => document.body.innerText)
  if (/Spider 20"\s*:\s*-?\d/.test(txt)) throw new Error('Spider 20" still shows a non-zero pending chip')
})

await page.screenshot({ path: 'test-shots/iphone-safari-filter.png', fullPage: true })
await b.close()
console.log('\n' + (errors.length === 0 ? '✅ WORKS on iPhone Safari (WebKit) — live site' : '❌ ' + errors.join('\n  ')))
