/**
 * Interactive setup: pick the creator, pick the first post of the book,
 * name the book. Writes book.config.json so nothing has to be hand-edited.
 */
import { createInterface } from 'node:readline/promises'
import { launch, isLoggedIn } from './browser.mjs'
import { resolveCampaignId } from './campaign.mjs'
import { listPosts } from './posts.mjs'
import { DEFAULT_CONFIG, CONFIG_PATH, configExists, saveConfig } from './config.mjs'

if (!process.stdin.isTTY) {
  console.error('\nRun `npm run init` directly in a terminal — it asks questions.\n')
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = async (q, fallback = '') => {
  const a = (await rl.question(fallback ? `${q} [${fallback}] ` : `${q} `)).trim()
  return a || fallback
}

if (configExists()) {
  const go = await ask(`${CONFIG_PATH} already exists. Overwrite? (y/N)`, 'N')
  if (!/^y/i.test(go)) {
    console.log('Left it alone.')
    rl.close()
    process.exit(0)
  }
}

const ctx = await launch(true)
const page = ctx.pages()[0] ?? (await ctx.newPage())

if (!(await isLoggedIn(page))) {
  console.error('\nNot logged into Patreon yet. Run this first:\n\n  npm run login\n')
  await ctx.close()
  rl.close()
  process.exit(1)
}

console.log('\nStep 1 of 3 — which creator?')
console.log('Paste the creator\'s Patreon URL or just the name from it')
console.log('(for patreon.com/dinniman, either the full URL or "dinniman").\n')

let campaign = null
while (!campaign) {
  const slug = await ask('Creator:')
  if (!slug) continue
  try {
    campaign = await resolveCampaignId(page, slug)
    console.log(`  Found: ${campaign.title} (campaign ${campaign.campaignId})`)
  } catch (err) {
    console.log(`  ${err.message}`)
  }
}

console.log('\nStep 2 of 3 — where does the book start?')
console.log('Recent posts, newest first. Find the FIRST post of the book you want')
console.log('(usually a prologue or "Chapter 1") and enter its number.\n')

const posts = await listPosts(page, campaign.campaignId, { max: 40 })
posts.forEach((p, i) => {
  const lock = p.canView ? '' : '  [locked — your tier cannot read this]'
  console.log(`  ${String(i + 1).padStart(2)}) ${p.publishedAt.slice(0, 10)}  ${p.title}${lock}`)
})

let anchor = null
while (!anchor) {
  const pick = await ask(`\nFirst post of the book [1-${posts.length}]:`)
  anchor = posts[Number(pick) - 1]
  if (!anchor) console.log('  Not a valid number.')
}
console.log(`  Starting at: ${anchor.title}`)

console.log('\nStep 3 of 3 — name the book.')
const title = await ask('Book title:', anchor.title)
const author = await ask('Author:', campaign.title.split('|')[0].trim())
const outputName = await ask(
  'Output filename (no extension):',
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'book',
)

const cfg = {
  ...DEFAULT_CONFIG,
  creatorSlug: campaign.slug,
  campaignId: campaign.campaignId,
  title,
  author,
  outputName,
  anchorPostId: anchor.id,
}
saveConfig(cfg)

console.log(`\nSaved ${CONFIG_PATH}.`)
console.log('\nNow run:\n\n  npm run update\n\nThat downloads the chapters and builds the epub in out/.')
console.log('Run it again any time new chapters are posted.\n')

await ctx.close()
rl.close()
