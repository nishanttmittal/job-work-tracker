import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

const importFile = async (party, path) => {
  await page.click('text=📥 Import')
  await page.waitForSelector('text=Party for this file')
  // select party
  await page.locator('select').first().selectOption({ label: party })
  // upload
  await page.setInputFiles('input[type="file"]', path)
  await page.waitForSelector('text=ready to import', { timeout: 8000 })
  await page.click('button:has-text("Challans")')  // confirm button (only it says "Challans")
  await page.waitForSelector('text=ready to import', { state: 'detached', timeout: 8000 })
  await page.waitForTimeout(800)
}

await step('Admin login', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('button:has-text("Admin")')
  await page.fill('input[type=password]', '6133923_N')
  await page.click('text=Unlock')
  await page.waitForSelector('text=📥 Import')
})

await step('Import SRIRAM.xlsx', async () => {
  await importFile('Sriram', 'C:\\Users\\lenovo\\Desktop\\SRIRAM.xlsx')
})

await step('Import JITENDER.xlsx', async () => {
  await importFile('Jitender', 'C:\\Users\\lenovo\\Desktop\\JITENDER.xlsx')
})

await step('Challans created, all unique numbers', async () => {
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans') || '[]'))
  const nos = data.map(c => c.challanNo)
  if (data.length === 0) throw new Error('no challans imported')
  if (new Set(nos).size !== nos.length) throw new Error('DUPLICATE challan numbers!')
  const sri = data.filter(c => c.party === 'Sriram').length
  const jit = data.filter(c => c.party === 'Jitender').length
  console.log(`   → ${data.length} challans (Sriram ${sri}, Jitender ${jit}), all unique`)
  // spot check: a known row — Sriram 2025-09-09 OUT had 1" Frame:150, Burfi:36
  const sept9 = data.find(c => c.party === 'Sriram' && c.date === '2025-09-09' && c.direction === 'out')
  if (!sept9) throw new Error('missing Sriram 2025-09-09 OUT challan')
  const burfi = sept9.items.find(i => /burfi/i.test(i.product))
  if (!burfi || burfi.quantity !== 36) throw new Error('Burfi qty wrong: ' + JSON.stringify(sept9.items))
})

await step('Dashboard renders imported data', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=Dashboard')
  await page.click('text=Dashboard'); await page.waitForTimeout(800)
  await page.waitForSelector('text=Party-wise Pending Material', { timeout: 4000 })
})
await page.screenshot({ path: 'test-shots/import-dashboard.png', fullPage: true })

await b.close()
console.log(errors.length === 0 ? '\n✅ ALL CLEAN — real Excel files imported' : '\n❌ ' + errors.join('\n  '))
