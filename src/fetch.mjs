import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { launch, isLoggedIn } from './browser.mjs'
import { apiGet } from './api.mjs'
import { listPosts } from './posts.mjs'
import { loadConfig } from './config.mjs'
import { docToMarkdown } from './richtext.mjs'
import { RAW_DIR, CH_DIR } from './paths.mjs'
import { main } from './cli.mjs'

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

/** Story posts from the anchor forward, oldest first. */
function selectPosts(all, anchor, cfg) {
  const include = new RegExp(cfg.include, 'i')
  const exclude = new RegExp(cfg.exclude, 'i')
  const extra = new Set(cfg.extraPostIds ?? [])
  const skip = new Set(cfg.skipPostIds ?? [])

  return all
    .filter((p) => p.publishedAt >= anchor.publishedAt)
    .filter((p) => !skip.has(p.id))
    .filter((p) => extra.has(p.id) || (include.test(p.title) && !exclude.test(p.title)))
    // Ties broken by id so ordering never depends on the order the API replied in.
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id))
}

/** Cached post body -> markdown, with chapter breaks promoted to headings. */
function toMarkdown(raw) {
  // Current posts carry ProseMirror JSON; older ones carry HTML.
  const source = raw.doc
    ? docToMarkdown(raw.doc)
    : execFileSync('pandoc', ['-f', 'html', '-t', 'markdown_strict', '--wrap=none'], {
        input: raw.html ?? '',
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })

  const body = source
    .split('\n')
    .map((line) => {
      const bare = line.trim().replace(/^\*+|\*+$/g, '').trim()
      const isBreak = /^(prologue|epilogue|interlude(\s+\w+)?|chapter\s+[\w-]+)[.:]?$/i.test(bare)
      return isBreak ? `\n## ${bare}\n` : line
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return `# ${raw.title}\n\n${body}\n`
}

await main(async () => {
  const cfg = loadConfig()
  mkdirSync(RAW_DIR, { recursive: true })
  mkdirSync(CH_DIR, { recursive: true })

  const ctx = await launch(true)
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage())
    if (!(await isLoggedIn(page))) {
      throw new Error('Not logged into Patreon. Run:  npm run login')
    }

    const all = await listPosts(page, cfg.campaignId, { max: 400 })
    const anchor = all.find((p) => p.id === cfg.anchorPostId)
    if (!anchor) {
      throw new Error(
        `Could not find the starting post (id ${cfg.anchorPostId}) in this creator's feed.\n` +
          'It may have been deleted, or the config may point at the wrong creator.\n' +
          'Re-run:  npm run init',
      )
    }

    const selected = selectPosts(all, anchor, cfg)
    console.log(`${selected.length} story post(s) from ${anchor.publishedAt.slice(0, 10)} onward.`)

    let downloaded = 0
    let locked = 0
    for (const post of selected) {
      const rawPath = join(RAW_DIR, `${post.id}.json`)
      if (existsSync(rawPath)) continue

      if (!post.canView) {
        locked++
        console.log(`  skipped, your tier cannot read it: ${post.title}`)
        continue
      }

      const detail = await apiGet(
        page,
        `/api/posts/${post.id}?json-api-version=1.0&json-api-use-default-includes=false&include=%5B%5D` +
          `&fields%5Bpost%5D=title%2Ccontent%2Ccontent_json_string%2Cpublished_at%2Curl`,
      )
      const attrs = detail.data?.attributes ?? {}
      const doc = attrs.content_json_string ? JSON.parse(attrs.content_json_string) : null
      if (!doc && !attrs.content) {
        console.log(`  skipped, no text in the post: ${post.title}`)
        continue
      }

      // Written to a temp file first so an interrupted run never leaves a
      // half-written post that later runs would treat as already downloaded.
      const tmpPath = `${rawPath}.tmp`
      writeFileSync(
        tmpPath,
        JSON.stringify(
          {
            id: post.id,
            title: attrs.title,
            publishedAt: attrs.published_at,
            url: attrs.url,
            doc,
            html: attrs.content ?? null,
          },
          null,
          2,
        ),
      )
      renameSync(tmpPath, rawPath)
      downloaded++
      console.log(`  downloaded: ${post.title}`)
      await page.waitForTimeout(1200) // stay gentle on the API
    }

    // Regenerate every chapter file from cache so numbering stays consistent.
    const rendered = []
    let n = 0
    for (const post of selected) {
      const rawPath = join(RAW_DIR, `${post.id}.json`)
      if (!existsSync(rawPath)) continue
      const raw = JSON.parse(readFileSync(rawPath, 'utf8'))
      n++
      rendered.push({
        name: `${String(n).padStart(3, '0')}-${slug(raw.title)}.md`,
        text: toMarkdown(raw),
      })
    }

    // Only clear the old files once every new one has been produced successfully.
    for (const f of readdirSync(CH_DIR)) rmSync(join(CH_DIR, f))
    for (const { name, text } of rendered) writeFileSync(join(CH_DIR, name), text)

    console.log(`${downloaded} new post(s) downloaded; ${rendered.length} section(s) ready.`)
    if (locked) console.log(`${locked} post(s) skipped — your membership tier cannot read them.`)
  } finally {
    await ctx.close()
  }
})
