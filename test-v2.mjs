import { chromium, devices } from 'playwright'

const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
page.on('pageerror', e => errors.push('PAGE: ' + e.message))

const shot = async (n) => { await page.screenshot({ path: `test-shots/v2-${n}.png`, fullPage: true }); console.log(`  📸 v2-${n}`) }
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(`[${l}] ${e.message}`) } }

console.log('\n=== PLATING JOB WORK — v2 FEATURE TEST ===\n')

await step('Boot + clear + migrate', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  const v = await page.evaluate(() => localStorage.getItem('jwt:__schema_version'))
  if (v !== '2') throw new Error('schema version should be 2, got ' + v)
})

await step('Title says Plating Job Work', async () => {
  await page.waitForSelector('text=Plating Job Work', { timeout: 5000 })
})
await shot('1-home')

await step('New Challan — BULK 2 products', async () => {
  await page.click('text=New Challan')
  await page.waitForSelector('text=Products in this Challan')
  // item 1: first product, qty 100
  await page.locator('select').nth(1).selectOption({ index: 1 }) // first item product select (0 is party)
  await page.locator('input[type=number]').first().fill('100')
  // add second product row
  await page.click('text=+ Add Another Product')
  await page.locator('select').last().selectOption({ index: 2 })
  await page.locator('input[type=number]').nth(1).fill('50')
  await page.click('button:has-text("Save Challan")')
  await page.waitForSelector('text=Challan Saved', { timeout: 5000 })
  await page.waitForTimeout(800)
})
await shot('2-after-bulk-save')

await step('Challan has unique number PJW-0001', async () => {
  const challans = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans') || '[]'))
  if (challans.length !== 1) throw new Error('expected 1 challan, got ' + challans.length)
  if (challans[0].challanNo !== 'PJW-0001') throw new Error('challanNo = ' + challans[0].challanNo)
  if (challans[0].items.length !== 2) throw new Error('expected 2 items, got ' + challans[0].items.length)
})

await step('Dashboard — party-wise pending cards', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Dashboard')
  await page.click('text=Dashboard'); await page.waitForTimeout(600)
  const hasPending = await page.locator('text=/product\\(s\\) pending/').count()
  if (hasPending === 0) throw new Error('no party-wise pending summary')
})
await shot('3-dashboard')

await step('Modify — challan shows number + items', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Modify Challans')
  await page.click('text=Modify Challans'); await page.waitForTimeout(400)
  await page.waitForSelector('text=PJW-0001', { timeout: 4000 })
})
await shot('4-modify')

await step('Admin → reconcile + logs tabs', async () => {
  await page.click('text=Home'); await page.waitForSelector('button:has-text("Admin")')
  await page.click('button:has-text("Admin")')
  await page.fill('input[type=password]', '6133923_N')
  await page.click('text=Unlock')
  await page.waitForSelector('text=Reconcile', { timeout: 5000 })
  await page.click('text=📜 Logs')
  await page.waitForSelector('text=CREATE', { timeout: 4000 }) // create log recorded
})
await shot('5-admin-logs')

await step('7-day reminder shows for backdated OUT', async () => {
  // inject a backdated OUT challan 10 days ago and reload
  await page.evaluate(() => {
    const key = 'jwt:challans'
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    const d = new Date(); d.setDate(d.getDate() - 10)
    const iso = d.toISOString().slice(0, 10)
    list.push({ id: 'old1', challanNo: 'PJW-9001', date: iso, party: 'Jitender', direction: 'out',
      gaadi: '', items: [{ product: 'Fan', quantity: 40 }], reconciled: false, reconcileReason: '',
      createdAt: new Date().toISOString() })
    localStorage.setItem(key, JSON.stringify(list))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('text=Dashboard'); await page.waitForTimeout(500)
  await page.waitForSelector('text=/Pending Over 7 Days/', { timeout: 4000 })
})
await shot('6-reminder')

await browser.close()
console.log('\n=== RESULT ===')
console.log(errors.length === 0 ? '✅ ALL CLEAN' : `❌ ${errors.length} issue(s):\n  ` + errors.join('\n  '))
