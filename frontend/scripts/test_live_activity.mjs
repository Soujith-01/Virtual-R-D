import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5173'
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'
const HEADLESS = process.env.HEADLESS !== 'false'

const here = dirname(fileURLToPath(import.meta.url))
const shotDir = resolve(here, '..', 'screenshots_live_activity')
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
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

async function clickByText(page, text, timeout = 10_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const clicked = await page.evaluate((needle) => {
      const candidates = Array.from(document.querySelectorAll('button, [onClick], .cursor-pointer, h3, a'))
      const needleLower = needle.toLowerCase()
      let target = candidates.find((el) => el.innerText && el.innerText.trim().toLowerCase() === needleLower)
      if (!target) {
        target = candidates.find((el) => el.innerText && el.innerText.toLowerCase().includes(needleLower))
      }
      if (!target) return false
      target.click()
      return true
    }, text)
    if (clicked) return true
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`clickable element containing "${text}" not found within ${timeout}ms`)
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1200'],
    defaultViewport: { width: 1600, height: 1200 },
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

    /* 1. Navigate to Workspace */
    console.log('Navigating to Workspace...')
    await clickByText(page, 'Browse Experiment Templates')
    check('choose: opened', await waitForText(page, 'Choose Your Experiment', 15_000))

    await clickByText(page, 'Reaction Yield Optimization')
    check('workspace: opened', await waitForText(page, 'Research workspace', 15_000))

    /* 2. Run AI Pipeline */
    console.log('Generating experiments...')
    await clickByText(page, 'Generate experiments')
    check('pipeline overlay', await waitForText(page, 'AI research agent running', 10_000))
    check('dashboard: opened', await waitForText(page, 'Candidate experiment dashboard', 90_000))

    /* 3. Click Start virtual experiment */
    console.log('Clicking Start virtual experiment...')
    await clickByText(page, 'Start virtual experiment')
    check('apparatus: opened', await waitForText(page, 'Experimental Apparatus & Equipment Setup', 20_000))

    /* 4. Click Perform Experiment */
    console.log('Clicking Perform Experiment...')
    await clickByText(page, 'Perform Experiment')
    check('reactor: opened', await waitForText(page, 'Experiment Stages', 30_000))

    /* 5. Verify Live Activity Panel Components */
    console.log('Verifying Live Activity Panel...')
    check('live: whats happening now visible', await waitForText(page, "What's Happening Now", 10_000))
    check('live: current action sentence present', await waitForText(page, 'Current Action', 10_000))
    check('live: reactor contents visible', await waitForText(page, 'Reactor Contents', 10_000))
    check('live: experiment activity timeline visible', await waitForText(page, 'Experiment Activity', 10_000))
    check('live: current conditions visible', await waitForText(page, 'Current Conditions', 10_000))
    check('live: experiment progress visible', await waitForText(page, 'EXPERIMENT PROGRESS', 10_000))

    // Capture active simulation screenshot
    await page.screenshot({ path: resolve(shotDir, '01-simulation-in-progress.png'), fullPage: true })

    // Wait a few seconds for simulation to reach reaction stage
    console.log('Waiting for reaction stage...')
    await new Promise((r) => setTimeout(r, 6000))
    await page.screenshot({ path: resolve(shotDir, '02-simulation-reaction-stage.png'), fullPage: true })

    // Wait for simulation to finish or near finish
    console.log('Waiting for simulation completion...')
    const completed = await waitForText(page, 'VIRTUAL EXPERIMENT COMPLETE', 60_000)
    check('live: completion banner rendered', completed)
    await page.screenshot({ path: resolve(shotDir, '03-simulation-complete.png'), fullPage: true })

    /* 6. Click View Research Report */
    console.log('Clicking View Research Report...')
    await clickByText(page, 'View Research Report')
    check('report: opened', await waitForText(page, 'Best candidate experiment', 20_000))
    await page.screenshot({ path: resolve(shotDir, '04-research-report.png') })

  } catch (err) {
    console.error('Test step error:', err)
    check(`live activity test completed (${err.message})`, false)
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
  console.log('\nALL LIVE EXPERIMENT ACTIVITY PANEL CHECKS PASSED!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
