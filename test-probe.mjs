import { chromium, devices } from 'playwright'
const BASE = 'http://localhost:5173/job-work-tracker/'
const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()) })
page.on('pageerror', e => errors.push('PAGE: ' + e.message))
const step = async (l, fn) => { try { await fn(); console.log('🔍 ' + l) } catch (e) { console.log('❌ ' + l + ' → ' + e.message); errors.push(`[${l}] ${e.message}`) } }

console.log('\n=== EDGE-CASE PROBES ===\n')

await step('Save button disabled with no quantity', async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('text=New Challan')
  await page.waitForSelector('text=Products in this Challan')
  const disabled = await page.locator('button:has-text("Save Challan")').isDisabled()
  if (!disabled) throw new Error('Save should be disabled with empty quantity')
})

await step('24h-locked challan shows lock, no edit button', async () => {
  await page.evaluate(() => {
    const old = new Date(); old.setDate(old.getDate() - 2) // createdAt 2 days ago
    localStorage.setItem('jwt:__schema_version', '2')
    localStorage.setItem('jwt:challan_counter', '1')
    localStorage.setItem('jwt:challans', JSON.stringify([{
      id: 'lock1', challanNo: 'PJW-0001', date: new Date().toISOString().slice(0,10),
      party: 'Sriram', direction: 'out', gaadi: '', items: [{ product: 'Spider', quantity: 50 }],
      reconciled: false, reconcileReason: '', createdAt: old.toISOString(),
    }]))
    localStorage.setItem('jwt:logs', '[]')
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('text=Modify Challans')
  await page.waitForSelector('text=PJW-0001')
  const lockText = await page.locator('text=/Locked after 24h/').count()
  if (lockText === 0) throw new Error('locked challan should show "Locked after 24h"')
  // edit pencil should NOT be present for locked challan
  const editBtns = await page.locator('button[title="Edit"]').count()
  if (editBtns !== 0) throw new Error('locked challan must not expose an edit button')
})

await step('Search with no match shows empty state', async () => {
  await page.fill('input[type=search]', 'zzzznomatch')
  await page.waitForTimeout(300)
  await page.waitForSelector('text=No challans match', { timeout: 3000 })
})

await step('Unlocked (fresh) challan IS editable', async () => {
  await page.evaluate(() => {
    localStorage.setItem('jwt:challans', JSON.stringify([{
      id: 'fresh1', challanNo: 'PJW-0002', date: new Date().toISOString().slice(0,10),
      party: 'Sriram', direction: 'out', gaadi: '', items: [{ product: 'Spider', quantity: 50 }],
      reconciled: false, reconcileReason: '', createdAt: new Date().toISOString(),
    }]))
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.click('text=Modify Challans')
  await page.waitForSelector('text=PJW-0002')
  const editBtns = await page.locator('button[title="Edit"]').count()
  if (editBtns === 0) throw new Error('fresh challan should be editable')
})

await step('Delete a challan (confirm flow)', async () => {
  await page.click('button[title="Delete"]')
  await page.waitForSelector('text=/Delete PJW-0002/')
  await page.click('button:has-text("Yes, Delete")')
  await page.waitForTimeout(400)
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('jwt:challans')).length)
  if (left !== 0) throw new Error('challan not deleted, ' + left + ' left')
})

await browser.close()
console.log('\n=== RESULT ===')
console.log(errors.length === 0 ? '✅ ALL PROBES PASSED' : `❌ ${errors.length}:\n  ` + errors.join('\n  '))
