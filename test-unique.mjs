import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l) } }

const makeChallan = async () => {
  await page.click('text=New Challan')
  await page.waitForSelector('text=Products in this Challan')
  await page.locator('select').nth(1).selectOption({ index: 1 })
  await page.locator('input[type=number]').first().fill('10')
  await page.click('button:has-text("Save Challan")')
  await page.waitForSelector('text=Challan Saved', { timeout: 5000 })
  await page.waitForTimeout(900)
  await page.click('text=Home'); await page.waitForSelector('text=New Challan')
}

await step('clean boot', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
})

await step('Create 3 challans → all unique', async () => {
  await makeChallan(); await makeChallan(); await makeChallan()
  const nos = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans')).map(c => c.challanNo))
  if (new Set(nos).size !== nos.length) throw new Error('duplicate! ' + nos.join(','))
  if (JSON.stringify(nos.sort()) !== JSON.stringify(['PJW-0001','PJW-0002','PJW-0003'])) throw new Error('unexpected: ' + nos)
})

await step('DRIFT: counter behind existing → no reuse', async () => {
  // simulate a restored backup: challans exist up to PJW-0003 but counter reset to 1
  await page.evaluate(() => localStorage.setItem('jwt:challan_counter', '1'))
  await page.reload({ waitUntil: 'networkidle' })
  await makeChallan()
  const nos = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans')).map(c => c.challanNo))
  if (new Set(nos).size !== nos.length) throw new Error('DUPLICATE after drift! ' + nos.join(','))
  if (!nos.includes('PJW-0004')) throw new Error('expected PJW-0004, got ' + nos.join(','))
})

await step('COLLISION guard: existing PJW-0005, counter=4 → skips to 0006', async () => {
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('jwt:challans'))
    list.push({ id: 'manual5', challanNo: 'PJW-0005', date: new Date().toISOString().slice(0,10), party: 'Sriram', direction: 'out', gaadi: '', items: [{ product: 'Spider', quantity: 5 }], reconciled: false, reconcileReason: '', createdAt: new Date().toISOString() })
    localStorage.setItem('jwt:challans', JSON.stringify(list))
    localStorage.setItem('jwt:challan_counter', '4')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await makeChallan()
  const nos = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans')).map(c => c.challanNo))
  if (new Set(nos).size !== nos.length) throw new Error('DUPLICATE! ' + nos.join(','))
  if (!nos.includes('PJW-0006')) throw new Error('expected PJW-0006, got ' + nos.sort().join(','))
})

await b.close()
console.log(errors.length === 0 ? '\n✅ ALL UNIQUE — no duplicates under drift or collision' : '\n❌ ' + errors.join(', '))
