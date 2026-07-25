import { firefox } from 'playwright'
import { mkdirSync } from 'node:fs'
import { PROFILE_DIR } from './paths.mjs'

export { PROFILE_DIR }

/** Launch Firefox with the persistent profile that holds the Patreon session. */
export async function launch(headless) {
  mkdirSync(PROFILE_DIR, { recursive: true })
  try {
    return await firefox.launchPersistentContext(PROFILE_DIR, {
      headless,
      viewport: { width: 1280, height: 900 },
    })
  } catch (err) {
    if (/Executable doesn't exist|Please run the following command/i.test(err.message)) {
      throw new Error('Firefox for automation is not installed yet. Run:  npm run setup')
    }
    if (/ProcessSingleton|already running|profile.*lock/i.test(err.message)) {
      throw new Error(
        'Another copy of this tool still has the browser open.\n' +
          'Close it, or run:  pkill -f ff-profile',
      )
    }
    throw err
  }
}

/**
 * True when the browser still has a valid Patreon session.
 * Runs inside the page so the request carries the real cookie jar —
 * Playwright's APIRequestContext does not behave the same here.
 */
export async function isLoggedIn(page) {
  if (!page.url().includes('patreon.com')) {
    await page.goto('https://www.patreon.com/', { waitUntil: 'domcontentloaded' })
  }
  return page.evaluate(async () => {
    const res = await fetch('/api/current_user?json-api-version=1.0', {
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return false
    const body = await res.json().catch(() => null)
    return Boolean(body?.data?.id)
  })
}
