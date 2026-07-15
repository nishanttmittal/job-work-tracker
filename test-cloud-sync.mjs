import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const browser = await chromium.launch()
const ctxA = await browser.newContext({ ...devices['iPhone 13'] })
const ctxB = await browser.newContext()
const A = await ctxA.newPage()
const B = await ctxB.newPage()
for (const [n, p] of [['A', A], ['B', B]]) {
  p.on('console', m => { if (m.type() === 'error') errors.push(`${n} C:` + m.text()) })
  p.on('pageerror', e => errors.push(`${n} P:` + e.message))
}
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

console.log('\n=== CLOUD MULTI-DEVICE SYNC TEST (real Firestore) ===\n')

await step('Both devices connect to cloud', async () => {
  await A.goto(BASE, { waitUntil: 'domcontentloaded' })
  await B.goto(BASE, { waitUntil: 'domcontentloaded' })
  await A.waitForSelector('text=New Challan', { timeout: 20000 })
  await B.waitForSelector('text=New Challan', { timeout: 20000 })
})

await step('Reset cloud (Admin) on device A', async () => {
  await A.click('button:has-text("Admin")')
  await A.fill('input[type=password]', '[removed]')
  await A.click('text=Unlock')
  await A.click('text=⚙️ Manage')
  await A.click('button:has-text("Reset All Challans")')
  await A.click('button:has-text("Yes, Reset")')
  await A.waitForTimeout(2500)
  await A.click('text=Home')
})

await step('Device A creates a challan (123 pcs)', async () => {
  await A.click('text=New Challan')
  await A.waitForSelector('text=Products in this Challan')
  await A.locator('select').nth(1).selectOption({ index: 1 })
  await A.locator('input[type=number]').first().fill('123')
  await A.click('button:has-text("Save Challan")')
  await A.waitForSelector('text=Challan Saved', { timeout: 12000 })
  await A.waitForTimeout(3000)
})

await step('Device B sees it LIVE (real-time sync)', async () => {
  await B.click('text=Dashboard')
  await B.waitForSelector('text=/123 pcs/', { timeout: 15000 })
  const nos = await B.evaluate(() => document.body.innerText.match(/PJW-\d+/g) || [])
  if (!nos.length) throw new Error('no challan number on device B')
  console.log('   → B sees ' + nos[0] + ' synced from A')
})

await step('Device B creates another (77 pcs) → unique number', async () => {
  await B.click('text=Home'); await B.waitForSelector('text=New Challan')
  await B.click('text=New Challan')
  await B.waitForSelector('text=Products in this Challan')
  await B.locator('select').nth(1).selectOption({ index: 1 })
  await B.locator('input[type=number]').first().fill('77')
  await B.click('button:has-text("Save Challan")')
  await B.waitForSelector('text=Challan Saved', { timeout: 12000 })
  await B.waitForTimeout(3000)
})

await step('Device A now sees BOTH, all unique numbers', async () => {
  await A.click('text=Home'); await A.waitForSelector('text=New Challan')
  await A.click('text=Modify Challans'); await A.waitForTimeout(2500)
  const nos = await A.evaluate(() => [...new Set(document.body.innerText.match(/PJW-\d+/g) || [])])
  console.log('   → A sees: ' + nos.join(', '))
  if (nos.length < 2) throw new Error('expected 2 unique challans, saw ' + nos.join(','))
})

await browser.close()
console.log('\n=== RESULT ===')
console.log(errors.length === 0 ? '✅ CLOUD SYNC WORKS — live multi-device, unique numbers' : `❌ ${errors.length}:\n  ` + errors.join('\n  '))
