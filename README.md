# patreon-serial-epub

Turns a serialized book you already read on Patreon into a single `.epub` you can put on your e-reader — and keeps it updated as the author posts new chapters.

Built for novels posted chapter-by-chapter (the [Dungeon Crawler Carl](https://www.patreon.com/dinniman) model), but it works for any creator whose posts you can read.

## Please read this first

- **You need your own paid membership.** This tool logs in as *you* and downloads only what your membership already lets you read. It does not bypass paywalls, and posts above your tier are skipped with a note.
- **The output is for you.** The downloaded text is the author's copyrighted work. Keep the epub on your own devices. Don't share it, upload it, or post it anywhere. If you stop supporting the creator, delete it.
- **Support the author.** This is a convenience for reading on an e-reader, not a substitute for buying the book when it's released.
- **Not affiliated with Patreon or any creator.** Uses Patreon's website the same way your browser does. Automated access may conflict with [Patreon's terms of use](https://www.patreon.com/policy/legal) — you are responsible for how you use it. Requests are deliberately slow and single-threaded; don't change that.
- **Downloaded text never enters git.** `content/`, `out/`, `*.epub`, `book.config.json`, and `.auth/` are gitignored. Keep it that way if you fork this.

## What you need

| | |
|---|---|
| **Node.js 18+** | https://nodejs.org — download the LTS installer |
| **pandoc** | builds the epub. macOS: `brew install pandoc` · Windows: `winget install --id JohnMacFarlane.Pandoc` · Linux: `sudo apt install pandoc` |
| **A Patreon membership** | to the creator whose book you want |

Firefox for automation is downloaded for you in the setup step (~100 MB). It's separate from any browser you normally use and won't touch your everyday profile.

## Setup

Four commands, once:

```bash
npm install       # get the code's dependencies
npm run setup     # check Node + pandoc, download Firefox for automation
npm run login     # a Firefox window opens — log into Patreon in it
npm run init      # pick the creator and where the book starts
```

`npm run setup` tells you exactly what's missing and how to install it, then you re-run it.

`npm run login` opens a real browser window. Log in normally — password, email code, captcha, whatever Patreon asks. The script waits (up to 20 minutes) and closes itself once you're in. Your session is saved in `.auth/`, so you generally only do this once every few months.

`npm run init` asks three things: the creator (paste their Patreon URL), which post the book starts at (it shows a numbered list — pick the prologue or chapter 1), and what to call the book. It writes `book.config.json` for you.

## Everyday use

```bash
npm run update
```

Downloads any new chapters and rebuilds the epub at `out/<name>.epub`. Run it whenever the author posts. It's safe to run repeatedly — posts already downloaded are never fetched again, and the epub is rebuilt from scratch each time.

That's the whole thing.

## When something looks wrong

**"Not logged into Patreon"** — your session expired. `npm run login` again.

**A new chapter didn't show up.** The tool decides what's a chapter by matching post titles, and authors title posts inconsistently. Check what it saw:

```bash
npm run list 15
```

If a story post is missing, add its id to `extraPostIds` in `book.config.json`. If something that isn't a chapter got included, add its id to `skipPostIds`. These overrides beat the title matching, so reach for them before touching the `include` / `exclude` patterns.

**The author posts out of order, or titles are too messy to match.** If the creator keeps a Patreon collection for the book, build from that instead. Add its link to `book.config.json`:

```json
"collectionUrl": "https://www.patreon.com/collection/1234567",
"collectionOrder": "published"
```

The collection then decides which posts are in the book. The starting post and the `include` / `exclude` patterns are ignored, and so is `extraPostIds`. `skipPostIds` still works. `collectionOrder` picks the reading order:

| Value | Order |
|---|---|
| `published` (default) | oldest post first, by publish date |
| `collection` | exactly as the creator arranged the collection |
| `collection-reversed` | the creator's arrangement, last to first. Use this for collections kept newest-first |

Run `npm run list 200` to hear the whole collection read out in book order, numbered, before you build. Collections are maintained by hand: if a chapter is missing from the epub, check whether it is missing from the collection itself.

**"your tier cannot read it"** — that post is above your membership level. Nothing to fix here.

**The browser won't start** — a previous run may still have it open: `pkill -f ff-profile`.

## 1Password users (optional)

If you have the [1Password CLI](https://developer.1password.com/docs/cli/) with desktop-app integration:

```bash
npm run login -- --1password
```

It finds the item whose URL matches `patreon.com`, prompts for your fingerprint, fills your email and password, and enters a TOTP code if your item has one. Credentials go straight from `op` into the browser field — never printed, never written to disk. Everyone else can ignore this; the normal login works fine.

## How it works

```
npm run login     Firefox + persistent profile in .auth/  → Patreon session
npm run init      resolve creator → campaign id, pick anchor post → book.config.json
npm run fetch     list posts (feed or collection) → filter to the book → download bodies → content/
npm run build     content/chapters/*.md → pandoc → out/<name>.epub
npm run update    fetch + build
```

Post bodies are cached as JSON under `content/posts/` and are the source of truth; the markdown in `content/chapters/` is regenerated from that cache on every run, so chapter numbering stays stable. One Patreon post becomes one epub section; chapter breaks inside a post (`Chapter 12`, `Interlude`, `Epilogue`) become sub-headings in the table of contents.

## Multiple books

Point `PSE_CONFIG` at a different config file:

```bash
PSE_CONFIG=./other-book.config.json npm run update
```

Copy `book.config.example.json` as a starting point, or run `init` and rename the result. Cached posts are shared across configs, so switching books doesn't re-download anything.

## License

MIT — see [LICENSE](LICENSE). The license covers this code only, not anything you download with it.
