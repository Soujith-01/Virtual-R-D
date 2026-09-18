import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5173'
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'
const HEADLESS = process.env.HEADLESS !== 'false'

const here = dirname(fileURLToPath(import.meta.url))
const shotDir = resolve(here, '..', 'screenshots_apparatus')
if (!existsSync(shotDir)) mkdirSync(shotDir, { recursive: true })

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const executablePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate))
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH.')
  process.exit(2)
}

const consoleErrors = []
const pageErrors = []
const checks = []

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${name}`)
}

async function waitForText(page, text, timeout = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const found = await page.evaluate(
      (needle) => document.body.innerText.toLowerCase().includes(needle.toLowerCase()),
      text,
    )
    if (found) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  return false
}

async function clickButton(page, text) {
  const clicked = await page.evaluate((needle) => {
    const candidates = Array.from(document.querySelectorAll('button'))
    const needleLower = needle.toLowerCase()
    let target = candidates.find((el) => el.innerText && el.innerText.trim().toLowerCase() === needleLower)
    if (!target) {
      target = candidates.find((el) => el.innerText && el.innerText.toLowerCase().includes(needleLower))
    }
    if (!target) return false
    target.click()
    return true
  }, text)
  if (!clicked) throw new Error(`button containing "${text}" not found`)
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1100'],
    defaultViewport: { width: 1600, height: 1100 },
  })
  const page = await browser.newPage()

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  try {
    console.log('Navigating to app...')
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60_000 })
    check('landing rendered', await waitForText(page, 'NUCLEUS AI'))

    /* 1. Add paper from Research Papers first to verify literature-derived apparatus */
    console.log('Navigating to Research Papers...')
    await clickButton(page, 'Research Papers')
    check('papers: loaded', await waitForText(page, 'Live Literature'))
    
    console.log('Clicking topic chip Reaction Yield ML...')
    await clickButton(page, 'Reaction Yield ML')
    check('papers: results loaded', await waitForText(page, 'Citations', 45_000))

    console.log('Adding paper to research context...')
    await clickButton(page, 'Use in Research')
    await new Promise((r) => setTimeout(r, 800))
    check('papers: added to research context', await waitForText(page, 'Added to Research Context', 10_000))

    /* 2. Navigate to Workspace */
    console.log('Navigating to Workspace...')
    await clickButton(page, 'Research Workspace')
    check('workspace: loaded', await waitForText(page, 'Experimental design space', 20_000))

    /* 3. Run AI Pipeline */
    console.log('Generating experiments...')
    await clickButton(page, 'Generate experiments')
    check('dashboard: generated', await waitForText(page, 'Candidate experiment dashboard', 90_000))
    await page.screenshot({ path: resolve(shotDir, '01-candidates-dashboard.png') })

    /* 4. Click "Select & simulate" on candidate card */
    console.log('Clicking "Select & simulate" on candidate card...')
    await clickButton(page, 'Select & simulate')
    
    /* 5. Verify Apparatus Setup Page */
    check('apparatus: page loaded', await waitForText(page, 'Experimental Apparatus & Equipment Setup', 15_000))
    check('apparatus: candidate summary visible', await waitForText(page, 'Candidate ID', 10_000))
    check('apparatus: core equipment rendered', await waitForText(page, 'High-Pressure Jacketed Autoclave Reactor', 10_000))
    check('apparatus: literature apparatus rendered', await waitForText(page, 'Literature-Derived Apparatus', 10_000))
    check('apparatus: reagents table rendered', await waitForText(page, 'Chemical Reagents', 10_000))
    check('apparatus: safety specs rendered', await waitForText(page, 'Safety Specifications', 10_000))
    check('apparatus: perform experiment button present', await waitForText(page, 'Perform Experiment', 10_000))
    await page.screenshot({ path: resolve(shotDir, '02-apparatus-page-full.png'), fullPage: true })

    /* 6. Click "Perform Experiment" */
    console.log('Clicking "Perform Experiment" button...')
    await clickButton(page, 'Perform Experiment')
    
    /* 7. Verify Virtual Experiment Simulation starts */
    check('simulation: virtual experiment opened', await waitForText(page, 'Experiment Stages', 30_000))
    await page.screenshot({ path: resolve(shotDir, '03-virtual-simulation.png') })

    /* 8. Skip to Report */
    console.log('Skipping to report...')
    await clickButton(page, 'Skip to report')
    check('report: opened', await waitForText(page, 'Best candidate experiment', 30_000))
    await page.screenshot({ path: resolve(shotDir, '04-report.png') })

  } catch (err) {
    console.error('Test step error:', err)
    check(`e2e test completed successfully (${err.message})`, false)
  } finally {
    await browser.close()
  }

  console.log('\n--- diagnostics ---')
  console.log(`console errors: ${consoleErrors.length}`)
  consoleErrors.slice(0, 5).forEach((e) => console.log(' !', e.slice(0, 150)))
  console.log(`page errors: ${pageErrors.length}`)
  pageErrors.slice(0, 5).forEach((e) => console.log(' !', e.slice(0, 150)))

  const failed = checks.filter((c) => !c.ok)
  console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length) {
    process.exit(1)
  }
  console.log('\nALL APPARATUS PAGE CHECKS PASSED!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
