import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l) } }

await step('seed multi-product challans', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const d = new Date().toISOString().slice(0,10)
    localStorage.clear()
    localStorage.setItem('jwt:__schema_version', '2')
    localStorage.setItem('jwt:challan_counter', '3')
    localStorage.setItem('jwt:challans', JSON.stringify([
      { id: 'c1', challanNo: 'PJW-0001', date: d, party: 'Sriram', direction: 'out', gaadi: '', items: [{ product: 'Spider', quantity: 100 }, { product: 'Beeta', quantity: 60 }], reconciled: false, reconcileReason: '', createdAt: new Date().toISOString() },
      { id: 'c2', challanNo: 'PJW-0002', date: d, party: 'Sriram', direction: 'in', gaadi: '', items: [{ product: 'Spider', quantity: 30 }], reconciled: false, reconcileReason: '', createdAt: new Date().toISOString() },
      { id: 'c3', challanNo: 'PJW-0003', date: d, party: 'Jitender', direction: 'out', gaadi: '', items: [{ product: 'Fan', quantity: 40 }], reconciled: false, reconcileReason: '', createdAt: new Date().toISOString() },
    ]))
    localStorage.setItem('jwt:logs', '[]')
  })
  await page.reload({ waitUntil: 'networkidle' })
})

await step('Dashboard shows total + name-wise balances', async () => {
  await page.click('text=Dashboard'); await page.waitForTimeout(500)
  await page.waitForSelector('text=Party-wise Pending Material')
  // total = Sriram(Spider 70 + Beeta 60 =130) + Jitender(Fan 40) = 170
  await page.waitForSelector('text=Total: 170 pcs', { timeout: 4000 })
  // name-wise chips
  await page.waitForSelector('text=Spider: 70', { timeout: 4000 })
  await page.waitForSelector('text=Beeta: 60', { timeout: 4000 })
  await page.waitForSelector('text=Fan: 40', { timeout: 4000 })
})
await page.screenshot({ path: 'test-shots/partywise.png', fullPage: true })
await b.close()
console.log(errors.length === 0 ? '\n✅ ALL CLEAN' : '\n❌ ' + errors.join(', '))
