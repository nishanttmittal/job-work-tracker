import { webkit, devices } from 'playwright'
const URL = process.argv[2] || 'http://localhost:5173/job-work-tracker/'
const logs = []
const b = await webkit.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[PAGEERROR] ${e.message}`))
page.on('requestfailed', r => logs.push(`[REQFAIL] ${r.url().slice(0,80)} ${r.failure()?.errorText}`))

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(16000)
const body = await page.evaluate(() => document.body.innerText.slice(0, 200))
console.log('URL:', URL)
console.log('BODY @16s:', JSON.stringify(body))
console.log('LOGS:')
logs.slice(0, 40).forEach(l => console.log('  ' + l))
await b.close()
process.exit(0)
