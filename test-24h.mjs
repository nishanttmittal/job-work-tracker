import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

console.log('\n=== 24h MODIFY VISIBILITY ===\n')
await step('Load app', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
})

await step('Modify (password) HIDES the 2-day-old PJW-9999', async () => {
  await page.click('text=Modify Challans')
  await page.waitForSelector('text=Enter Password to Modify')
  await page.fill('input[type=password]', 'nsp@123')
  await page.click('button:has-text("Unlock")')
  await page.waitForSelector('input[type=search]', { timeout: 6000 })
  await page.waitForTimeout(1500)
  const txt = await page.evaluate(() => document.body.innerText)
  if (txt.includes('PJW-9999')) throw new Error('old challan still visible in Modify')
  if (!txt.includes('last 24 hours')) throw new Error('24h notice missing')
})

await step('Admin → Reconcile SHOWS PJW-9999 (still editable there)', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=New Challan')
  await page.click('button:has-text("Admin")')
  await page.fill('input[type=password]', '6133923_N')
  await page.click('button:has-text("Unlock with Password")')
  await page.waitForSelector('text=🔧 Reconcile', { timeout: 6000 })
  await page.fill('input[type=search]', '9999')
  await page.waitForTimeout(1000)
  const txt = await page.evaluate(() => document.body.innerText)
  if (!txt.includes('PJW-9999')) throw new Error('old challan not editable in Admin Reconcile')
})

await b.close()
console.log('\n' + (errors.length === 0 ? '✅ 24h rule works: hidden in Modify, available in Admin' : '❌ ' + errors.join('\n  ')))
