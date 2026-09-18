/**
 * End-to-end smoke test for the Virtual R&D Lab dashboard.
 *
 * Drives the real UI in a real browser against the real backend, walks the whole
 * demo flow (landing -> workspace -> prediction -> candidates -> reactor ->
 * report) and fails on any console error or missing expected text.
 *
 * Prerequisites: backend on http://127.0.0.1:8000 and the Vite dev server on
 * http://127.0.0.1:5173 (or set APP_URL / API_URL).
 *
 *   node ./scripts/smoke.mjs
 */
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5173'
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'
const HEADLESS = process.env.HEADLESS !== 'false'

const here = dirname(fileURLToPath(import.meta.url))
const shotDir = resolve(here, '..', 'screenshots')
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
  console.error('No Chrome found. Set CHROME_PATH to your browser executable.')
  process.exit(2)
}

const consoleErrors = []
const pageErrors = []
const failedRequests = []
const checks = []

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${name}`)
}

async function reachable(url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Wait until the page's visible text contains `text`.
 *
 * Comparison is case-insensitive on purpose: several labels use `text-transform:
 * uppercase`, and `innerText` returns the *rendered* (upper-cased) string.
 */
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

async function clickByText(page, text) {
  const clicked = await page.evaluate((needle) => {
    const candidates = Array.from(document.querySelectorAll('button, [onClick], .cursor-pointer, h3, a'))
    const target = candidates.find((el) => el.innerText && el.innerText.toLowerCase().includes(needle.toLowerCase()))
    if (!target) return false
    target.click()
    return true
  }, text)
  if (!clicked) throw new Error(`clickable element containing "${text}" not found`)
}

const run = async () => {
  if (!(await reachable(`${API_URL}/health`))) {
    console.error(
      `Backend not reachable at ${API_URL}. Start it first:\n  cd backend && python -m uvicorn main:app --reload`,
    )
    process.exit(2)
  }
  if (!(await reachable(APP_URL))) {
    console.error(
      `Frontend not reachable at ${APP_URL}. Start the dev server first:\n  cd frontend && npm run dev`,
    )
    process.exit(2)
  }

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
  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.startsWith(API_URL) || url.startsWith(APP_URL)) {
      failedRequests.push(`${request.failure()?.errorText} ${url}`)
    }
  })

  try {
    /* ----------------------------- landing ----------------------------- */
    await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60_000 })
    await page.screenshot({ path: resolve(shotDir, '01-landing.png') })
    check('landing: hero title rendered', await waitForText(page, 'NUCLEUS AI'))
    check('landing: subtitle rendered', await waitForText(page, 'Experimental Discovery'))
    check('landing: model connected to API', await waitForText(page, 'Surrogate model online', 15_000))

    /* -------------------------- choose & workspace -------------------------- */
    await clickByText(page, 'Browse Experiment Templates')
    check('choose: opens template selection', await waitForText(page, 'Select an Experiment Domain'))
    await page.screenshot({ path: resolve(shotDir, '02-choose.png') })

    await clickByText(page, 'Reaction Yield')
    check('workspace: opens', await waitForText(page, 'Research workspace'))
    check('workspace: design space loaded from API', await waitForText(page, 'Experimental design space'))
    await page.screenshot({ path: resolve(shotDir, '03-workspace.png') })

    /* --------------------------- ML prediction --------------------------- */
    await clickByText(page, 'Predict')
    check('predict: returns a prediction', await waitForText(page, 'Predicted', 30_000))
    check('predict: shows confidence proxy', await waitForText(page, 'confidence', 30_000))
    await page.screenshot({ path: resolve(shotDir, '04-prediction.png') })

    /* --------------------------- full pipeline --------------------------- */
    await clickByText(page, 'Generate experiments')
    check('pipeline: overlay appears', await waitForText(page, 'AI research agent running', 10_000))
    await page.screenshot({ path: resolve(shotDir, '05-pipeline.png') })

    check('dashboard: candidates rendered', await waitForText(page, 'Candidate experiment dashboard', 90_000))
    check('dashboard: recommendation flagged', await waitForText(page, 'RECOMMENDED', 20_000))
    check('dashboard: scores shown', await waitForText(page, 'score', 20_000))
    check('dashboard: score transparency', await waitForText(page, 'How each score was built', 20_000))
    await page.screenshot({ path: resolve(shotDir, '06-dashboard.png'), fullPage: true })

    /* ----------------------------- apparatus & reactor ------------------ */
    await clickByText(page, 'Start virtual experiment')
    check('apparatus: opens', await waitForText(page, 'Experimental Apparatus & Equipment Setup', 20_000))
    await clickByText(page, 'Perform Experiment')
    check('reactor: opens', await waitForText(page, 'Experiment Stages', 60_000))
    check('reactor: stage timeline listed', await waitForText(page, 'COMPLETE', 20_000))
    await page.screenshot({ path: resolve(shotDir, '07-reactor.png') })

    /* ------------------------------ report ------------------------------ */
    await clickByText(page, 'Skip to report')
    check('report: opens', await waitForText(page, 'Best candidate experiment', 30_000))
    check('report: AI explanation', await waitForText(page, 'Why this experiment', 20_000))
    check('report: retrieved knowledge', await waitForText(page, 'Retrieved scientific knowledge', 20_000))
    check('report: next experiment', await waitForText(page, 'Next suggested experiment', 20_000))
    await page.screenshot({ path: resolve(shotDir, '08-report.png'), fullPage: true })

    /* --------------------------- one-click demo --------------------------- */
    await clickByText(page, 'New research')
    check('demo: returns to landing', await waitForText(page, 'Browse Experiment Templates', 20_000))
    await page.click('#btn-run-demo')
    check('demo: pipeline starts automatically', await waitForText(page, 'AI research agent running', 20_000))
    check('demo: reactor opens automatically', await waitForText(page, 'Experiment Stages', 90_000))
    await page.screenshot({ path: resolve(shotDir, '09-demo-reactor.png') })
    check('demo: report opens automatically', await waitForText(page, 'Best candidate experiment', 60_000))
    await page.screenshot({ path: resolve(shotDir, '10-demo-report.png') })
  } catch (error) {
    check(`flow completed (${error.message})`, false)
  } finally {
    await browser.close()
  }

  /* ------------------------------- summary ------------------------------- */
  console.log('\n--- browser diagnostics ---')
  console.log(`console errors : ${consoleErrors.length}`)
  consoleErrors.slice(0, 8).forEach((message) => console.log(`   ! ${message.slice(0, 200)}`))
  console.log(`page errors    : ${pageErrors.length}`)
  pageErrors.slice(0, 8).forEach((message) => console.log(`   ! ${message.slice(0, 200)}`))
  console.log(`failed requests: ${failedRequests.length}`)
  failedRequests.slice(0, 8).forEach((message) => console.log(`   ! ${message.slice(0, 200)}`))

  const failed = checks.filter((item) => !item.ok)
  console.log(`\nchecks: ${checks.length - failed.length}/${checks.length} passed`)
  console.log(`screenshots: ${shotDir}`)

  if (failed.length || consoleErrors.length || pageErrors.length || failedRequests.length) {
    process.exit(1)
  }
  console.log('\nSMOKE TEST PASSED')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
