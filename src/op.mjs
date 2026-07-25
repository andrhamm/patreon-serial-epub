import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'

const SITE = 'patreon.com'

/**
 * Find the Patreon login item in 1Password by URL.
 * One match -> use it. Several -> ask. None -> explain how to fix.
 * Only titles/vaults are ever printed; secrets never leave memory.
 */
export async function resolveItem(override) {
  if (override) return override

  const items = JSON.parse(
    execFileSync('op', ['item', 'list', '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  )

  const matches = items.filter((i) =>
    (i.urls ?? []).some((u) => (u.href ?? '').toLowerCase().includes(SITE)),
  )

  if (matches.length === 1) {
    console.log(`Using 1Password item: ${matches[0].title} (${matches[0].vault?.name})`)
    return matches[0].id
  }

  if (matches.length === 0) {
    throw new Error(
      `No 1Password item has a ${SITE} URL. Add one to the item, or set DCC_OP_ITEM=<id>.`,
    )
  }

  console.log(`${matches.length} 1Password items match ${SITE}:`)
  matches.forEach((m, n) => console.log(`  ${n + 1}) ${m.title} — vault ${m.vault?.name}`))

  if (!process.stdin.isTTY) {
    throw new Error('Multiple matches and no terminal to ask. Re-run with DCC_OP_ITEM=<id>.')
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`Which one? [1-${matches.length}] `)
  rl.close()
  const picked = matches[Number(answer) - 1]
  if (!picked) throw new Error('No item selected.')
  return picked.id
}

/**
 * Read credentials. Triggers the 1Password biometric prompt.
 * Values stay in memory — never logged, never written to disk.
 */
export function credentials(item) {
  const fields = JSON.parse(
    execFileSync(
      'op',
      ['item', 'get', item, '--reveal', '--format', 'json', '--fields', 'label=username,label=password'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    ),
  )
  const pick = (label) => fields.find((f) => f.label === label)?.value
  return { username: pick('username'), password: pick('password') }
}

/** One-time TOTP if the item carries one, else null. */
export function totp(item) {
  try {
    return (
      execFileSync('op', ['item', 'get', item, '--otp'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'inherit'],
      }).trim() || null
    )
  } catch {
    return null
  }
}
