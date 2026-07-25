/**
 * Checks everything this tool needs and installs what it can.
 * Safe to run repeatedly.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { platform } from 'node:os'

const ok = (m) => console.log(`  OK    ${m}`)
const bad = (m) => console.log(`  MISS  ${m}`)

const INSTALL_HINTS = {
  darwin: {
    pandoc: 'brew install pandoc      (get Homebrew at https://brew.sh)',
  },
  linux: {
    pandoc: 'sudo apt install pandoc  (or your distro\'s package manager)',
  },
  win32: {
    pandoc: 'winget install --id JohnMacFarlane.Pandoc',
  },
}
const hint = (tool) => INSTALL_HINTS[platform()]?.[tool] ?? `install ${tool}: https://pandoc.org/installing.html`

console.log('\nChecking what this tool needs...\n')
let missing = 0

// 1. Node version.
const major = Number(process.versions.node.split('.')[0])
if (major >= 18) ok(`Node.js ${process.versions.node}`)
else {
  bad(`Node.js ${process.versions.node} — need 18 or newer. Get it from https://nodejs.org`)
  missing++
}

// 2. Pandoc turns the downloaded chapters into an epub.
try {
  const v = execFileSync('pandoc', ['--version'], { encoding: 'utf8' }).split('\n')[0]
  ok(v)
} catch {
  bad(`pandoc not found — ${hint('pandoc')}`)
  missing++
}

// 3. Playwright's own copy of Firefox (separate from any browser you use).
console.log('  ...    checking Firefox for automation (downloads ~100 MB the first time)')
const install = spawnSync('npx', ['--yes', 'playwright', 'install', 'firefox'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  encoding: 'utf8',
})
if (install.status === 0) ok('Firefox for automation')
else {
  bad('could not install Firefox for automation:')
  console.log((install.stderr || install.stdout || '').split('\n').slice(-6).join('\n'))
  missing++
}

console.log('')
if (missing) {
  console.log(`${missing} thing(s) still needed — install them above, then run: npm run setup\n`)
  process.exit(1)
}
console.log('Everything is ready. Next:\n')
console.log('  npm run login     log into Patreon once')
console.log('  npm run init      pick the creator and where the book starts')
console.log('  npm run update    download chapters and build the epub\n')
