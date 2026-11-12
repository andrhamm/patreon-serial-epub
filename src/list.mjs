import { launch, isLoggedIn } from './browser.mjs'
import { loadConfig } from './config.mjs'
import { listPosts, orderCollection } from './posts.mjs'
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

    if (cfg.collectionId) {
      // The whole collection is needed before it can be put in reading order.
      const all = await listPosts(page, cfg.campaignId, { collectionId: cfg.collectionId })
      const posts = orderCollection(all, cfg.collectionOrder).slice(0, limit)
      const skip = new Set(cfg.skipPostIds ?? [])
      console.log(
        `${posts.length} of ${all.length} posts in collection ${cfg.collectionId}, ` +
          `in book order (${cfg.collectionOrder}). "skip" marks posts left out.\n`,
      )
      posts.forEach((p, i) => {
        const flags = [p.canView ? '    ' : 'LOCK', skip.has(p.id) ? 'skip' : '    ']
        console.log(
          `${String(i + 1).padStart(3)}  ${p.id}  ${p.publishedAt.slice(0, 10)}  ${flags.join(' ')}  ${p.title}`,
        )
      })
      return
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
