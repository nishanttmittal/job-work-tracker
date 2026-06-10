import { webkit, devices } from 'playwright'
const LIVE = 'https://nishanttmittal.github.io/job-work-tracker/'
const logs = []
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`))

await page.goto(LIVE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(12000)  // give Firebase time

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300))
console.log('=== WHAT SAFARI SHOWS AFTER 12s ===')
console.log(JSON.stringify(bodyText))
console.log('\n=== CONSOLE / ERRORS ===')
logs.slice(0, 30).forEach(l => console.log(l))
await page.screenshot({ path: 'test-shots/webkit-state.png', fullPage: true })
await b.close()
process.exit(0)
