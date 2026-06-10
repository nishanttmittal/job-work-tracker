import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

console.log('\n=== ADD NEW PRODUCT IN NEW CHALLAN ===\n')
await step('Open New Challan', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
  await page.click('text=New Challan')
  await page.waitForSelector('text=Products in this Challan')
})

await step('+ New Product reveals input', async () => {
  await page.click('button:has-text("+ New Product")')
  await page.waitForSelector('input[placeholder="New product name"]', { timeout: 4000 })
})

await step('Add "ZZTEMPPROD" → selected in item row', async () => {
  await page.fill('input[placeholder="New product name"]', 'ZZTEMPPROD')
  await page.click('button:has-text("Add")')
  await page.waitForTimeout(1500)
  // the first item product select should now have ZZTEMPPROD selected
  const selected = await page.evaluate(() => {
    const sels = [...document.querySelectorAll('select')]
    return sels.some(s => s.value === 'ZZTEMPPROD')
  })
  if (!selected) throw new Error('new product not selected in item row')
})

await step('New product persisted to catalogue (in dropdown options)', async () => {
  const inOptions = await page.evaluate(() =>
    [...document.querySelectorAll('option')].some(o => o.value === 'ZZTEMPPROD'))
  if (!inOptions) throw new Error('product not in dropdown options')
})

await b.close()
console.log('\n' + (errors.length === 0 ? '✅ add-new-product works' : '❌ ' + errors.join('\n  ')))
