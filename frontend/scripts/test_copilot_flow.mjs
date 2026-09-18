import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

const BASE_URL = 'http://127.0.0.1:5173'
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'screenshots_copilot')

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean)

const executablePath = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate))
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH.')
  process.exit(2)
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function run() {
  console.log('Starting Experiment Copilot End-to-End Test...')
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  try {
    // 1. Navigate to /login and login as admin
    console.log('[1/10] Logging in as admin...')
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('#btn-quick-fill-admin')
    await page.click('#btn-quick-fill-admin')
    await sleep(300)
    await page.click('#btn-login-submit')
    await sleep(2000)

    // Verify redirected to dashboard/landing
    console.log('[2/10] Verifying persistent floating Copilot button on overview...')
    await page.waitForSelector('#btn-open-copilot', { visible: true, timeout: 8000 })
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-floating-copilot-button.png') })

    // 2. Open Copilot Drawer
    console.log('[3/10] Opening Experiment Copilot drawer...')
    await page.click('#btn-open-copilot')
    await page.waitForSelector('#panel-copilot-drawer', { visible: true })
    await sleep(500)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-copilot-drawer-open.png') })

    // 3. Test Guardrail with off-topic question
    console.log('[4/10] Testing off-topic guardrail: "Write me a poem about flowers"...')
    await page.type('#input-copilot-query', 'Write me a poem about flowers')
    await page.click('#btn-copilot-send')
    await sleep(1500)

    const guardrailReply = await page.evaluate(() => {
      const msgs = document.querySelectorAll('#panel-copilot-drawer .prose')
      return msgs[msgs.length - 1]?.textContent || ''
    })
    console.log('Guardrail reply:', guardrailReply)
    if (!guardrailReply.includes('I am the NUCLEUS AI Experiment Copilot')) {
      throw new Error('Guardrail failed to intercept off-topic query!')
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-guardrail-rejection.png') })

    // 4. Test scientific query on Overview
    console.log('[5/10] Testing scientific query: "What research questions can I explore?"...')
    await page.type('#input-copilot-query', 'What research questions can I explore in this lab?')
    await page.click('#btn-copilot-send')
    await sleep(2500)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-scientific-query-overview.png') })

    // 5. Navigate to Choose Experiment
    console.log('[6/10] Navigating to Choose Experiment page...')
    await page.goto(`${BASE_URL}/choose`, { waitUntil: 'networkidle2' })
    await sleep(1000)

    // Verify drawer or button persists
    const drawerStillOpen = await page.$('#panel-copilot-drawer')
    if (!drawerStillOpen) {
      await page.click('#btn-open-copilot')
      await sleep(500)
    }

    // Ask question on Choose page
    console.log('[7/10] Asking page-aware question on Choose Experiment...')
    await page.type('#input-copilot-query', 'Why should I choose this experiment?')
    await page.click('#btn-copilot-send')
    await sleep(2500)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-choose-experiment-copilot.png') })

    // 6. Test Quick Actions toggle
    console.log('[8/10] Testing Quick Actions toggle in Copilot...')
    await page.click('#btn-copilot-toggle-actions')
    await sleep(400)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-copilot-quick-actions.png') })

    // 7. Ask simulation / apparatus question
    console.log('[9/10] Asking apparatus and reactor question...')
    await page.type('#input-copilot-query', 'What apparatus is currently being used?')
    await page.click('#btn-copilot-send')
    await sleep(2500)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-apparatus-explanation.png') })

    // 8. Test Clear Chat
    console.log('[10/10] Testing Clear Chat button...')
    await page.click('#btn-copilot-clear')
    await sleep(500)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-cleared-chat.png') })

    console.log('\nSUCCESS! All Experiment Copilot End-to-End checks passed!')
  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

run()
