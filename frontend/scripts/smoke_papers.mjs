import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5173'
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'
const HEADLESS = process.env.HEADLESS !== 'false'

const here = dirname(fileURLToPath(import.meta.url))
const shotDir = resolve(here, '..', 'screenshots_papers')
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

    /* 1. Navigate to Research Papers */
    console.log('Clicking sidebar Research Papers...')
    await clickButton(page, 'Research Papers')
    check('papers: page loaded', await waitForText(page, 'Live Literature'))
    await page.screenshot({ path: resolve(shotDir, '01-papers-main.png') })

    /* 2. Click a Topic Chip to Search */
    console.log('Clicking topic chip Reaction Yield ML...')
    await clickButton(page, 'Reaction Yield ML')
    check('papers: search results loaded', await waitForText(page, 'Citations', 45_000))
    await page.screenshot({ path: resolve(shotDir, '02-papers-results.png') })

    /* 3. View Details Modal */
    console.log('Opening View Details modal...')
    await clickButton(page, 'View Details')
    check('papers: details modal open', await waitForText(page, 'Authentic Publication Metadata', 10_000))
    await page.screenshot({ path: resolve(shotDir, '03-papers-modal.png') })
    
    // Close modal & wait for backdrop animation to exit
    console.log('Closing modal...')
    await clickButton(page, 'Close')
    await new Promise((r) => setTimeout(r, 1200))

    /* 4. Use in Research on the paper card */
    console.log('Adding paper to research context...')
    await clickButton(page, 'Use in Research')
    await new Promise((r) => setTimeout(r, 800))
    check('papers: added to research context', await waitForText(page, 'Added to Research Context', 10_000))
    await page.screenshot({ path: resolve(shotDir, '04-papers-in-research.png') })

    /* 5. Save to Library */
    console.log('Saving paper to library...')
    await clickButton(page, 'Save')
    await new Promise((r) => setTimeout(r, 1000))
    check('papers: saved state updated', await waitForText(page, 'Saved', 10_000))

    /* 6. Navigate to Workspace via Sidebar */
    console.log('Navigating to Workspace...')
    await clickButton(page, 'Research Workspace')
    check('workspace: loaded', await waitForText(page, 'Experimental design space', 20_000))
    check('workspace: literature context banner visible', await waitForText(page, 'Literature Context', 10_000))
    check('workspace: paper count displayed', await waitForText(page, '1 Selected', 10_000))
    await page.screenshot({ path: resolve(shotDir, '05-workspace-with-papers.png') })

    /* 7. Run AI Pipeline with papers */
    console.log('Generating experiments with paper context...')
    await clickButton(page, 'Generate experiments')
    check('pipeline: overlay active', await waitForText(page, 'AI research agent running', 10_000))
    
    check('dashboard: experiments generated', await waitForText(page, 'Candidate experiment dashboard', 90_000))
    await page.screenshot({ path: resolve(shotDir, '06-dashboard-with-papers.png') })

    /* 8. Move to Virtual Reactor and Skip to Report */
    console.log('Starting reactor...')
    await clickButton(page, 'Start virtual experiment')
    check('reactor: opened', await waitForText(page, 'Experiment Stages', 30_000))
    
    await clickButton(page, 'Skip to report')
    check('report: opened', await waitForText(page, 'Best candidate experiment', 30_000))
    
    /* 9. Verify RELEVANT RESEARCH PAPERS in Report */
    check('report: relevant papers section rendered', await waitForText(page, 'RELEVANT RESEARCH PAPERS', 20_000))
    check('report: literature context badge rendered', await waitForText(page, 'Abstract-based research context', 20_000))
    await page.screenshot({ path: resolve(shotDir, '07-report-with-papers.png'), fullPage: true })

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
  console.log('\nALL RESEARCH PAPERS E2E CHECKS PASSED!')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
