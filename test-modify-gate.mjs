import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

const openModify = async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Modify Challans')
  await page.click('text=Modify Challans')
}

console.log('\n=== MODIFY CHALLANS PASSWORD GATE ===\n')
await step('Load app', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
})

await step('Modify shows password gate (not the list)', async () => {
  await page.click('text=Modify Challans')
  await page.waitForSelector('text=Enter Password to Modify', { timeout: 5000 })
  const hasSearch = await page.locator('input[type=search]').count()
  if (hasSearch !== 0) throw new Error('challan list visible without password')
})

await step('Wrong password rejected', async () => {
  await page.fill('input[type=password]', 'wrong')
  await page.click('button:has-text("Unlock")')
  await page.waitForSelector('text=Incorrect password', { timeout: 4000 })
})

await step('User password nsp@123 opens it', async () => {
  await page.fill('input[type=password]', 'nsp@123')
  await page.click('button:has-text("Unlock")')
  await page.waitForSelector('input[type=search]', { timeout: 5000 })
})

await step('Admin password also opens it', async () => {
  await openModify()
  await page.waitForSelector('text=Enter Password to Modify', { timeout: 5000 })
  await page.fill('input[type=password]', '6133923_N')
  await page.click('button:has-text("Unlock")')
  await page.waitForSelector('input[type=search]', { timeout: 5000 })
})

await step('New Challan still open (no gate on entry)', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=New Challan')
  await page.click('text=New Challan')
  await page.waitForSelector('text=Products in this Challan', { timeout: 5000 })
})

await b.close()
console.log('\n' + (errors.length === 0 ? '✅ Modify gated by user password; New Challan stays open' : '❌ ' + errors.join('\n  ')))
