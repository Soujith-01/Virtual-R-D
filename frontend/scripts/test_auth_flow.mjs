import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const APP_URL = process.env.APP_URL || 'http://127.0.0.1:5173'
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'
const HEADLESS = process.env.HEADLESS !== 'false'

const here = dirname(fileURLToPath(import.meta.url))
const shotDir = resolve(here, '..', 'screenshots_auth')
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

const checks = []
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) })
  console.log(`${condition ? '  PASS' : '  FAIL'}  ${name}`)
}

async function waitForText(page, text, timeout = 25_000) {
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
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`clickable element containing "${text}" not found within ${timeout}ms`)
}

async function clearAndType(page, selector, text) {
  await page.click(selector, { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (el) {
      el.value = ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, selector)
  await page.type(selector, text)
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath,
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1100'],
    defaultViewport: { width: 1600, height: 1100 },
  })
  const page = await browser.newPage()

  try {
    const timestamp = Date.now()
    const testEmail = `dr.elena_${timestamp}@caltech.edu`
    const testPassword = 'ScienceDiscovery2026!'

    // A. Unauthenticated user opening app is redirected to /login
    console.log('Step A: Navigating to app (unauthenticated)...')
    await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2', timeout: 30_000 })
    check('A. unauthenticated redirected to login', await waitForText(page, 'AI-Powered Experimental Discovery'))
    check('A. login button visible', await waitForText(page, 'LOGIN'))
    await page.screenshot({ path: resolve(shotDir, '01-login-page.png') })

    // B. Navigate to Register page
    console.log('Step B: Navigating to Register page...')
    await clickByText(page, 'Create Researcher Account')
    check('B. register page opened', await waitForText(page, 'Researcher Registration'))
    await page.screenshot({ path: resolve(shotDir, '02-register-page.png') })

    // Fill registration form
    console.log('Filling registration form...')
    await page.type('#reg-fullname', 'Dr. Elena Vance')
    await page.type('#reg-email', testEmail)
    await page.type('#reg-password', testPassword)
    await page.type('#reg-confirm-password', testPassword)
    await page.type('#reg-org', 'Caltech Molecular Engineering')
    await page.click('#btn-register-submit')

    // C. Verify Registration Pending state
    console.log('Step C: Checking registration pending confirmation...')
    check('C. registration pending displayed', await waitForText(page, 'REGISTRATION PENDING', 15_000))
    check('C. awaiting approval text present', await waitForText(page, 'Your account is awaiting admin approval.'))
    await page.screenshot({ path: resolve(shotDir, '03-registration-pending.png') })

    // D. Return to login and attempt to log in before approval
    console.log('Step D: Attempting login with pending account...')
    await page.click('#btn-return-login')
    await waitForText(page, 'LOGIN')

    await clearAndType(page, '#login-email', testEmail)
    await clearAndType(page, '#login-password', testPassword)
    await page.click('#btn-login-submit')

    check('D. pending login blocked', await waitForText(page, 'Account Pending Approval', 15_000))
    check('D. pending notice displayed', await waitForText(page, 'waiting for administrator approval'))
    await page.screenshot({ path: resolve(shotDir, '04-login-blocked-pending.png') })

    // E. Admin logs in with default seeded admin credentials
    console.log('Step E: Logging in as Admin...')
    await clearAndType(page, '#login-email', 'admin@nucleus.ai')
    await clearAndType(page, '#login-password', 'AdminNucleus2026!')
    await page.click('#btn-login-submit')

    check('E. admin dashboard opened', await waitForText(page, 'Nucleus AI Administration', 20_000))
    check('E. user statistics visible', await waitForText(page, 'PENDING APPROVAL'))
    await page.screenshot({ path: resolve(shotDir, '05-admin-dashboard.png'), fullPage: true })

    // F. Admin sees pending researcher and approves
    console.log('Step F: Approving researcher in Admin Dashboard...')
    check('F. pending researcher listed', await waitForText(page, 'Dr. Elena Vance'))
    await clickByText(page, '✓ Approve')
    await new Promise((r) => setTimeout(r, 1500))
    check('F. approval notification shown', await waitForText(page, 'Approved Dr. Elena Vance'))
    await page.screenshot({ path: resolve(shotDir, '06-admin-approved.png') })

    // G. Admin logs out
    console.log('Step G: Admin logging out...')
    await page.click('#btn-admin-logout')
    check('G. returned to login page', await waitForText(page, 'LOGIN', 10_000))

    // H. Approved researcher logs in successfully
    console.log('Step H: Logging in as approved researcher...')
    await clearAndType(page, '#login-email', testEmail)
    await clearAndType(page, '#login-password', testPassword)
    await page.click('#btn-login-submit')

    check('H. researcher entered platform', await waitForText(page, 'NUCLEUS AI', 20_000))
    check('H. sidebar identity rendered', await waitForText(page, 'Dr. Elena Vance'))
    check('H. approved status badge present', await waitForText(page, 'APPROVED'))
    await page.screenshot({ path: resolve(shotDir, '07-researcher-logged-in.png'), fullPage: true })

    // I. Researcher navigates to Choose Experiment and Workspace
    console.log('Step I: Navigating to Choose Experiment...')
    await clickByText(page, 'Browse Experiment Templates')
    check('I. choose experiment opened', await waitForText(page, 'Choose Your Experiment', 15_000))
    await clickByText(page, 'Reaction Yield Optimization')
    check('I. research workspace opened', await waitForText(page, 'Research workspace', 15_000))
    await page.screenshot({ path: resolve(shotDir, '08-researcher-in-workspace.png') })

    // J. Non-admin researcher tries to visit /admin -> blocked
    console.log('Step J: Researcher attempting to access /admin...')
    await page.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle2' })
    check('J. non-admin blocked from admin page', await waitForText(page, 'Access Denied', 10_000))
    await page.screenshot({ path: resolve(shotDir, '09-access-denied-admin.png') })

    // K. Researcher logs out
    console.log('Step K: Testing researcher logout...')
    await clickByText(page, 'Return to R&D Lab')
    await waitForText(page, 'Overview')
    await page.click('#btn-sidebar-logout')
    check('K. successfully logged out to login page', await waitForText(page, 'LOGIN', 10_000))
    await page.screenshot({ path: resolve(shotDir, '10-logged-out.png') })

  } catch (err) {
    console.error('Test error:', err)
    check(`auth workflow test completed (${err.message})`, false)
  } finally {
    await browser.close()
  }

  console.log('\n--- test summary ---')
  const failed = checks.filter((c) => !c.ok)
  console.log(`checks: ${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length > 0) {
    console.error(`FAILED CHECKS (${failed.length}):`)
    failed.forEach((f) => console.error('  FAIL:', f.name))
    process.exit(1)
  } else {
    console.log('ALL AUTHENTICATION AND ADMIN WORKFLOW CHECKS PASSED!')
  }
}

run()
