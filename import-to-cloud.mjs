import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const party = process.argv[2] || 'Sriram'
const file = process.argv[3] || 'C:\\Users\\lenovo\\Desktop\\SRIRAM.xlsx'
const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))

console.log(`\n=== IMPORTING ${party} → CLOUD ===\n`)
try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
  console.log('✅ connected to cloud')

  await page.click('button:has-text("Admin")')
  await page.fill('input[type=password]', '6133923_N')
  await page.click('text=Unlock')
  await page.click('text=📥 Import')
  await page.waitForSelector('text=Party for this file')
  await page.locator('select').first().selectOption({ label: party })
  await page.setInputFiles('input[type="file"]', file)
  await page.waitForSelector('text=ready to import', { timeout: 10000 })

  // read the preview summary
  const summary = await page.evaluate(() => document.body.innerText)
  const totalMatch = summary.match(/Total challans\s*([\d]+)/)
  console.log('✅ parsed file — preview:', totalMatch ? totalMatch[1] + ' challans' : '(see screenshot)')

  await page.click('button:has-text("Challans")')   // confirm import
  // wait for the toast / preview to clear (import committed to cloud)
  await page.waitForSelector('text=ready to import', { state: 'detached', timeout: 25000 })
  await page.waitForTimeout(4000) // let the batch round-trip to Firestore
  console.log('✅ import committed')
} catch (e) {
  console.log('❌ ' + e.message)
  errors.push(e.message)
}
await browser.close()
console.log(errors.length === 0 ? '\n✅ DONE' : '\n❌ ' + errors.join('\n  '))
