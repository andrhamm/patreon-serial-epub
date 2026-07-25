/**
 * Download anything new, then rebuild the epub.
 * Safe to re-run; already-downloaded posts are never fetched twice.
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { ROOT } from './paths.mjs'

for (const script of ['fetch.mjs', 'build.mjs']) {
  const res = spawnSync(process.execPath, [join(ROOT, 'src', script)], { stdio: 'inherit' })
  if (res.status !== 0) process.exit(res.status ?? 1)
}
