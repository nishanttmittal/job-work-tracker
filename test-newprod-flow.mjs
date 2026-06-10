import { webkit, devices } from 'playwright'
const LIVE = 'https://nishanttmittal.github.io/job-work-tracker/'
const errors = []
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l) } }

await step('Open New Challan (live, iPhone Safari)', async () => {
  await page.goto(LIVE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 25000 })
  await page.click('text=New Challan')
  await page.waitForSelector('text=Products in this Challan')
})
await step('Add brand-new product name + quantity → Save enabled', async () => {
  await page.click('button:has-text("+ New Product")')
  await page.fill('input[placeholder="New product name"]', 'ZZNEWNAME')
  await page.click('button:has-text("Add")')
  await page.waitForTimeout(1500)
  // fill quantity in the row that now has ZZNEWNAME
  await page.locator('input[placeholder="Qty"]').first().fill('25')
  await page.waitForTimeout(500)
  const enabled = await page.locator('button:has-text("Save Challan")').isEnabled()
  if (!enabled) throw new Error('Save not enabled with new product + qty')
})
await b.close()
console.log('\n' + (errors.length === 0 ? '✅ NEW-NAME PRODUCT FLOW WORKS on live iPhone Safari' : '❌ ' + errors.join(', ')))
