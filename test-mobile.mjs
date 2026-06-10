import { chromium, devices } from 'playwright'

const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()

page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
page.on('pageerror', e => errors.push('PAGE: ' + e.message))

const shot = async (n) => { await page.screenshot({ path: `test-shots/m-${n}.png`, fullPage: true }); console.log(`  📸 m-${n}`) }
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(`[${l}] ${e.message}`) } }

console.log('\n=== MOBILE (iPhone 13) TEST ===\n')

await step('Load + clear', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
})
await shot('1-home')

await step('New schema/migration boot — no errors', async () => {
  const v = await page.evaluate(() => localStorage.getItem('jwt:__schema_version'))
  if (v !== '1') throw new Error('schema version not set, got ' + v)
})

await step('New Entry — quick qty chips', async () => {
  await page.click('text=New Entry')
  await page.waitForSelector('text=Quantity')
  await page.click('text=+100')   // quick chip
  await page.click('text=+50')    // now 150
  const val = await page.locator('input[type=number]').first().inputValue()
  if (val !== '150') throw new Error('Quick qty chips gave ' + val + ', expected 150')
})
await shot('2-new-entry-qty')

await step('Save OUT 150', async () => {
  await page.click('button:has-text("Save OUT")')
  await page.waitForSelector('text=Entry Saved', { timeout: 5000 })
  await page.waitForTimeout(2600)
})

await step('Switch IN, save 60', async () => {
  await page.click('text=↙ IN')
  await page.click('text=+50')
  await page.click('text=+10')
  await page.click('button:has-text("Save IN")')
  await page.waitForSelector('text=Entry Saved', { timeout: 5000 })
  await page.waitForTimeout(500)
})

await step('Dashboard balance', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Dashboard')
  await page.click('text=Dashboard'); await page.waitForTimeout(600)
})
await shot('3-dashboard')

await step('Modify — search works', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Modify Entries')
  await page.click('text=Modify Entries'); await page.waitForTimeout(400)
  await page.fill('input[type=search]', 'spider')
  await page.waitForTimeout(400)
  const cnt = await page.locator('text=/spider/i').count()
  if (cnt === 0) throw new Error('Search found nothing')
})
await shot('4-search')

await step('Admin backup downloads', async () => {
  await page.click('text=Home'); await page.waitForSelector('button:has-text("Admin")')
  await page.click('button:has-text("Admin")')
  await page.fill('input[type=password]', '6133923_N')
  await page.click('text=Unlock')
  await page.waitForSelector('text=Backup & Restore', { timeout: 5000 })
  const dl = page.waitForEvent('download', { timeout: 5000 })
  await page.click('text=Download Backup')
  const d = await dl
  if (!(await d.path())) throw new Error('No file downloaded')
})
await shot('5-admin')

await browser.close()

console.log('\n=== RESULT ===')
console.log(errors.length === 0 ? '✅ ALL CLEAN' : `❌ ${errors.length} issue(s):\n  ` + errors.join('\n  '))
