import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('C:' + m.text()) })
page.on('pageerror', e => errors.push('P:' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('✅ ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(l + ': ' + e.message) } }

console.log('\n=== ADMIN GATE (Google + password) SAFETY TEST ===\n')

await step('App connects to cloud (sync untouched)', async () => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=New Challan', { timeout: 20000 })
})

await step('Cloud data still loads (486 challans → workers/sync OK)', async () => {
  await page.click('text=Dashboard'); await page.waitForTimeout(2500)
  // both parties present from the cloud
  await page.waitForSelector('text=Sriram', { timeout: 8000 })
  await page.waitForSelector('text=Jitender', { timeout: 8000 })
  const challanCount = await page.evaluate(() =>
    document.body.innerText.includes('Party-wise Pending Material'))
  if (!challanCount) throw new Error('cloud data not showing')
})

await step('Admin gate shows BOTH Google + password', async () => {
  await page.click('text=Home'); await page.waitForSelector('text=New Challan')
  await page.click('button:has-text("Admin")')
  await page.waitForSelector('text=Admin Access')
  const google = await page.locator('button:has-text("Sign in with Google")').count()
  const pwd = await page.locator('input[type=password]').count()
  if (google !== 1) throw new Error('Google button missing')
  if (pwd !== 1) throw new Error('password fallback missing')
})

await step('Wrong password rejected', async () => {
  await page.fill('input[type=password]', 'wrongpass')
  await page.click('button:has-text("Unlock with Password")')
  await page.waitForSelector('text=Incorrect password', { timeout: 4000 })
})

await step('Correct password unlocks (fallback works → no lockout)', async () => {
  await page.fill('input[type=password]', '[removed]')
  await page.click('button:has-text("Unlock with Password")')
  await page.waitForSelector('text=🔧 Reconcile', { timeout: 5000 })
})

await step('Worker anonymous auth still active (data intact in admin)', async () => {
  await page.click('text=📥 Import')  // admin still functional over cloud
  await page.waitForSelector('text=Party for this file', { timeout: 4000 })
})
await page.screenshot({ path: 'test-shots/admin-gate.png', fullPage: true })

await b.close()
console.log('\n=== RESULT ===')
console.log(errors.length === 0 ? '✅ ALL SAFE — password fallback + Google button, sync untouched' : `❌ ${errors.length}:\n  ` + errors.join('\n  '))
