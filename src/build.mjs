import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from './config.mjs'
import { CH_DIR, OUT_DIR } from './paths.mjs'
import { main } from './cli.mjs'

await main(async () => {
  const cfg = loadConfig()
  mkdirSync(CH_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  const chapters = readdirSync(CH_DIR).filter((f) => f.endsWith('.md')).sort()
  if (chapters.length === 0) {
    throw new Error('Nothing downloaded yet. Run:  npm run update')
  }

  try {
    execFileSync('pandoc', ['--version'], { stdio: 'ignore' })
  } catch {
    throw new Error('pandoc is not installed — it is what builds the epub. Run:  npm run setup')
  }

  const today = new Date().toISOString().slice(0, 10)
  const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const metaPath = join(OUT_DIR, 'epub-metadata.yaml')
  writeFileSync(
    metaPath,
    [
      '---',
      `title: "${escape(cfg.title)}"`,
      `creator: "${escape(cfg.author)}"`,
      'language: en-US',
      `date: "${today}"`,
      `description: "Serialized Patreon posts, compiled ${today} for personal offline reading."`,
      '---',
      '',
    ].join('\n'),
  )

  const outFile = join(OUT_DIR, `${cfg.outputName}.epub`)
  execFileSync(
    'pandoc',
    [
      '--from=markdown_strict',
      '--to=epub3',
      '--toc',
      '--toc-depth=2',
      '--split-level=1',
      '--metadata-file', metaPath,
      '-o', outFile,
      ...chapters.map((c) => join(CH_DIR, c)),
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  )

  const words = chapters
    .map((c) => readFileSync(join(CH_DIR, c), 'utf8').split(/\s+/).length)
    .reduce((a, b) => a + b, 0)

  console.log(`\nBuilt ${outFile}`)
  console.log(`  ${chapters.length} section(s), ~${words.toLocaleString()} words`)
  console.log('  Copy it to your e-reader, or open it with any epub app.')
})
