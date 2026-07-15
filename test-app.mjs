import { chromium } from 'playwright'

const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const logs = []

const browser = await chromium.launch()
const page = await browser.newPage()

page.on('console', msg => {
  if (msg.type() === 'error') errors.push('CONSOLE ERROR: ' + msg.text())
  logs.push(`[${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message))

const shot = async (name) => {
  await page.screenshot({ path: `test-shots/${name}.png`, fullPage: true })
  console.log(`  📸 ${name}.png`)
}

const step = async (label, fn) => {
  try { await fn(); console.log('✅ ' + label) }
  catch (e) { console.log('❌ ' + label + ' → ' + e.message); errors.push(`STEP FAIL [${label}]: ${e.message}`) }
}

console.log('\n=== JOB WORK TRACKER — FULL TEST ===\n')

// 1. Load home
await step('Load home page', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('text=Job Work Tracker', { timeout: 5000 })
})
await shot('1-home')

// 2. Navigate to New Entry
await step('Open New Entry', async () => {
  await page.click('text=New Entry')
  await page.waitForSelector('text=OUTGOING', { timeout: 5000 })
})
await shot('2-new-entry')

// 3. Fill an OUTGOING entry (Sriram, Spider, 100 pcs)
await step('Create OUT entry: Sriram/Spider/100', async () => {
  await page.locator('input[type=number]').first().fill('100')
  await page.locator('input[type=text]').last().fill('HR55AB1234')
  await page.click('button:has-text("Save Outgoing")')
  await page.waitForSelector('text=Entry saved successfully', { timeout: 5000 })
  await page.waitForTimeout(2200) // let success banner clear
})
await shot('3-after-save-out')

// 4. Create an IN entry that EXCEEDS out (to trigger red flag): switch to IN, qty 150
await step('Create IN entry exceeding OUT (red flag)', async () => {
  await page.click('text=INCOMING')
  await page.locator('input[type=number]').first().fill('150')
  await page.click('button:has-text("Save Incoming")')
  await page.waitForSelector('text=Entry saved successfully', { timeout: 5000 })
  await page.waitForTimeout(500)
})
await shot('4-after-save-in')

// Verify both entries persisted
await step('Confirm 2 entries saved in storage', async () => {
  const count = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt_entries') || '[]').length)
  if (count !== 2) throw new Error(`Expected 2 entries, found ${count}`)
})

// 5. Dashboard — check balance + red flag
await step('Open Dashboard', async () => {
  await page.click('text=Home')
  await page.waitForSelector('text=Dashboard', { timeout: 5000 })
  await page.click('text=Dashboard')
  await page.waitForTimeout(800)
})
await shot('5-dashboard')

await step('Verify red flag appears (IN>OUT)', async () => {
  const hasFlag = await page.locator('text=/Excess IN|Alerts/').count()
  if (hasFlag === 0) throw new Error('No red flag shown despite IN(150) > OUT(100)')
})

// 6. Modify entries
await step('Open Modify Entries', async () => {
  await page.click('text=Home')
  await page.waitForSelector('text=Modify Entries')
  await page.click('text=Modify Entries')
  await page.waitForTimeout(500)
})
await shot('6-modify')

// 7. Export — balance report
await step('Open Export → Balance report', async () => {
  await page.click('text=Home')
  await page.waitForSelector('text=Export Report')
  await page.click('text=Export Report')
  await page.waitForTimeout(400)
  await page.click('text=Balance Summary')
  await page.click('text=Generate Report')
  await page.waitForTimeout(500)
})
await shot('7-export-balance')

// 8. Admin gate
await step('Open Admin (gate)', async () => {
  await page.click('text=Home')
  await page.waitForSelector('text=Admin')
  await page.click('button:has-text("Admin")')
  await page.waitForSelector('text=Admin Access Required', { timeout: 5000 })
})
await shot('8-admin-gate')

await step('Unlock Admin with password', async () => {
  await page.fill('input[type=password]', '[removed]')
  await page.click('text=Unlock')
  await page.waitForSelector('text=Rename Products', { timeout: 5000 })
})
await shot('9-admin-panel')

await browser.close()

console.log('\n=== RESULT ===')
if (errors.length === 0) {
  console.log('✅ ALL CLEAN — no console/page errors, all steps passed')
} else {
  console.log(`❌ ${errors.length} issue(s):`)
  errors.forEach(e => console.log('  - ' + e))
}
console.log('\nConsole logs captured:', logs.length)
