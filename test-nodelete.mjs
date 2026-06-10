import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l) } }

await step('seed fresh challan', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('jwt:__schema_version', '2')
    localStorage.setItem('jwt:challan_counter', '1')
    localStorage.setItem('jwt:challans', JSON.stringify([{ id: 'f1', challanNo: 'PJW-0001', date: new Date().toISOString().slice(0,10), party: 'Sriram', direction: 'out', gaadi: '', items: [{ product: 'Spider', quantity: 50 }], reconciled: false, reconcileReason: '', createdAt: new Date().toISOString() }]))
    localStorage.setItem('jwt:logs', '[]')
  })
  await page.reload({ waitUntil: 'networkidle' })
})
await step('Modify: NO delete button, edit present', async () => {
  await page.click('text=Modify Challans')
  await page.waitForSelector('text=PJW-0001')
  const del = await page.locator('button[title="Delete"]').count()
  const edit = await page.locator('button[title="Edit"]').count()
  if (del !== 0) throw new Error('delete still present: ' + del)
  if (edit !== 1) throw new Error('edit missing')
})
await step('Edit still works', async () => {
  await page.click('button[title="Edit"]')
  await page.waitForSelector('text=Save Changes')
  await page.locator('input[type=number]').first().fill('70')
  await page.click('button:has-text("Save Changes")')
  await page.waitForTimeout(400)
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans'))[0].items[0].quantity)
  if (q !== 70) throw new Error('edit failed, qty=' + q)
})
await page.screenshot({ path: 'test-shots/nodelete.png', fullPage: true })
await b.close()
console.log(errors.length === 0 ? '\n✅ ALL CLEAN' : '\n❌ ' + errors.join(', '))
