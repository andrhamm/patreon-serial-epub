import { launch, isLoggedIn } from './browser.mjs'
import { loadConfig } from './config.mjs'
import { listPosts } from './posts.mjs'
import { main } from './cli.mjs'

await main(async () => {
  const limit = Number(process.argv[2] ?? 25)
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('Usage:  npm run list [how-many-posts]')
  }
  const cfg = loadConfig()

  const ctx = await launch(true)
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage())
    if (!(await isLoggedIn(page))) {
      throw new Error('Not logged into Patreon. Run:  npm run login')
    }

    const posts = await listPosts(page, cfg.campaignId, { max: limit })
    console.log(`${posts.length} posts, newest first. "anchor" marks where your book starts.\n`)
    for (const p of posts) {
      const flags = [p.canView ? '    ' : 'LOCK', p.id === cfg.anchorPostId ? 'anchor' : '      ']
      console.log(`${p.id}  ${p.publishedAt.slice(0, 10)}  ${flags.join(' ')}  ${p.title}`)
    }
  } finally {
    await ctx.close()
  }
})
