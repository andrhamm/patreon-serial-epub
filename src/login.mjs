import { launch, isLoggedIn, PROFILE_DIR } from './browser.mjs'

const TIMEOUT_MS = 20 * 60 * 1000
const POLL_MS = 3000
const OTP_RETRY_MS = 35000 // TOTP codes rotate every 30s

const USE_OP = process.argv.includes('--1password') || process.argv.includes('--op')

const OTP_SELECTOR = [
  'input[autocomplete="one-time-code"]',
  'input[name*="code" i]',
  'input[id*="code" i]',
  'input[inputmode="numeric"]',
  'input[type="tel"]',
].join(', ')

/**
 * Optional 1Password autofill. Everything here is skipped unless --1password
 * is passed; the default flow is you typing into the browser window.
 */
async function autofill(page) {
  const { resolveItem, credentials, totp } = await import('./op.mjs')
  const item = await resolveItem(process.env.DCC_OP_ITEM)
  const { username, password } = credentials(item)
  if (!username || !password) throw new Error('item has no username or password field')

  const email = page.locator('input[type="email"], input[name="email"]').first()
  await email.waitFor({ timeout: 20000 })
  await email.fill(username)
  await page.keyboard.press('Enter')

  const pw = page.locator('input[type="password"]').first()
  await pw.waitFor({ timeout: 20000 })
  await pw.fill(password)
  await page.keyboard.press('Enter')
  console.log('Credentials submitted.')
  return { item, totp }
}

/** Fill a verification-code field from 1Password, if one is on screen. */
async function tryOtp(page, item, totp) {
  const field = page.locator(OTP_SELECTOR).first()
  if (!(await field.isVisible({ timeout: 1000 }).catch(() => false))) return false

  const code = totp(item) // fetched fresh each attempt — codes expire fast
  if (!code) return false
  await field.click()
  await field.fill('').catch(() => {})
  await page.keyboard.type(code, { delay: 60 })
  await page.keyboard.press('Enter')
  console.log('Verification code submitted.')
  return true
}

const ctx = await launch(false)
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto('https://www.patreon.com/login', { waitUntil: 'domcontentloaded' })

if (await isLoggedIn(page)) {
  console.log('Already logged in — nothing to do.')
  await ctx.close()
  process.exit(0)
}

let op = null
if (USE_OP) {
  try {
    op = await autofill(page)
  } catch (err) {
    console.log(`1Password autofill did not complete (${err.message}).`)
    console.log('Finish logging in yourself in the Firefox window.')
  }
} else {
  console.log('')
  console.log('  A Firefox window is open. Log into Patreon in it.')
  console.log('  This window is only used by this tool — your normal browser is untouched.')
  console.log('  (1Password users: re-run with `npm run login -- --1password` to autofill.)')
  console.log('')
}

console.log('Waiting for you to finish logging in (up to 20 min)... Ctrl-C to cancel.')
const deadline = Date.now() + TIMEOUT_MS
let ok = false
let lastOtpAt = 0

while (Date.now() < deadline) {
  await page.waitForTimeout(POLL_MS)
  try {
    if (await isLoggedIn(page)) {
      ok = true
      break
    }
  } catch {
    continue // mid-navigation
  }
  if (op && Date.now() - lastOtpAt > OTP_RETRY_MS) {
    if (await tryOtp(page, op.item, op.totp).catch(() => false)) lastOtpAt = Date.now()
  }
}

console.log(
  ok
    ? `Logged in. Session saved to ${PROFILE_DIR} — you should not need to do this again for a while.`
    : 'Timed out. Re-run `npm run login` when you have a moment to finish it.',
)
await ctx.close()
process.exit(ok ? 0 : 1)
