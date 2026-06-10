import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
page.on('pageerror', e => errors.push('PAGE: ' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(`[${l}] ${e.message}`) } }

console.log('\n=== RECONCILIATION + PWA TEST ===\n')

await step('Seed one challan, boot clean', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('jwt:__schema_version', '2')
    localStorage.setItem('jwt:challan_counter', '1')
    localStorage.setItem('jwt:challans', JSON.stringify([{
      id: 'c1', challanNo: 'PJW-0001', date: new Date().toISOString().slice(0,10),
      party: 'Sriram', direction: 'out', gaadi: '', items: [{ product: 'Spider', quantity: 100 }],
      reconciled: false, reconcileReason: '', createdAt: new Date().toISOString(),
    }]))
    localStorage.setItem('jwt:logs', '[]')
  })
  await page.reload({ waitUntil: 'networkidle' })
})

await step('Admin → Reconcile → edit with reason', async () => {
  await page.click('button:has-text("Admin")')
  await page.fill('input[type=password]', '6133923_N')
  await page.click('text=Unlock')
  await page.waitForSelector('text=🔧 Reconcile')
  await page.click('button:has-text("Edit")')
  await page.waitForSelector('input[placeholder="Reason for change (required)"]', { timeout: 5000 })
  // change qty
  await page.locator('input[type=number]').first().fill('80')
  await page.fill('input[placeholder="Reason for change (required)"]', 'Physical count correction')
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(600)
})

await step('Reconcile flag + reason persisted', async () => {
  const c = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans'))[0])
  if (!c.reconciled) throw new Error('not flagged reconciled')
  if (c.reconcileReason !== 'Physical count correction') throw new Error('reason missing: ' + c.reconcileReason)
  if (c.items[0].quantity !== 80) throw new Error('qty not updated: ' + c.items[0].quantity)
})

await step('RECONCILE log written', async () => {
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:logs')))
  if (!logs.some(l => l.action === 'RECONCILE')) throw new Error('no RECONCILE log')
})

await step('Dashboard shows Reconciliations card', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Dashboard')
  await page.click('text=Dashboard'); await page.waitForTimeout(500)
  await page.waitForSelector('text=/Reconciliations/', { timeout: 4000 })
  await page.waitForSelector('text=Physical count correction', { timeout: 4000 })
})
await page.screenshot({ path: 'test-shots/recon-dashboard.png', fullPage: true })

await browser.close()
console.log('\n=== RESULT ===')
console.log(errors.length === 0 ? '✅ ALL CLEAN' : `❌ ${errors.length}:\n  ` + errors.join('\n  '))
