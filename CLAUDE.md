# Working on this repo

Downloads a serialized book from Patreon posts the operator pays for and compiles it to epub. User-facing setup and troubleshooting live in README.md — don't duplicate them here.

## Non-negotiables

- **Never commit downloaded text.** `content/`, `out/`, `*.epub`, `book.config.json`, `.auth/` are gitignored. Don't narrow that list, don't add sample chapter text to docs or tests, don't paste post bodies into commit messages or PR descriptions.
- **Keep fetching serial and paced.** One post at a time, `waitForTimeout(1200)` between. Never parallelize the fetch loop or drop the delay.
- **Never print credentials.** `op` output goes straight into `locator.fill()`. No logging, no writing to disk, no echoing into error messages.
- **Download only what the account may read.** Posts with `canView === false` are skipped, never retried through another route.

## Files

| File | Role |
|---|---|
| `src/paths.mjs` | all filesystem locations |
| `src/browser.mjs` | Firefox launch, session check |
| `src/api.mjs` | Patreon JSON:API via in-page `fetch` |
| `src/posts.mjs` | post listing |
| `src/campaign.mjs` | creator URL name → campaign id |
| `src/config.mjs` | load/validate `book.config.json` |
| `src/richtext.mjs` | Patreon ProseMirror JSON → markdown |
| `src/fetch.mjs` | select posts, download, render chapters |
| `src/build.mjs` | chapters → epub via pandoc |
| `src/init.mjs`, `src/setup.mjs`, `src/login.mjs` | interactive entry points |

`content/posts/*.json` is the source of truth. `content/chapters/*.md` is regenerated from it every run — never hand-edit chapter files.

## Constraints that silently break things

| Rule | Why | Symptom if violated |
|---|---|---|
| Run with `node`, not `bun` | Bun's `node:http` shim hands Playwright a relative URL | `"/api/current_user…" cannot be parsed as a URL` |
| Keep `page[count]` at 20 | Larger pages return a stale window with no error | listing's newest post is months old; recent chapters vanish |
| Don't send `filter[is_draft]` | Unnecessary, present when the stale-window bug appeared | as above |
| Call the API via `page.evaluate(fetch)` | carries the real cookie jar | 401s despite a valid session |
| Read bodies from `content_json_string` | the `content` HTML field is `null` now | "no text in the post" for every post |
| One process per `.auth/ff-profile` | profile lock | launch fails; fix with `pkill -f ff-profile` |

## Changing which posts get included

`fetch.mjs` selects posts at or after the anchor whose title matches `include` and not `exclude`, with `extraPostIds` / `skipPostIds` overriding both.

Creators title posts inconsistently ("Book Eight Finale Extravaganza Chapters 79-80"), so misses are expected. Fix a specific miss by adding its id to the override lists — loosening the regexes to catch one post reliably pulls in announcements too.

## Verifying a change

```bash
npm run update      # end-to-end; should be idempotent on a second run
npm run list 15     # what the selector sees
unzip -l out/*.epub # EPUB3 package structure
```

A correct second `npm run update` reports `0 new post(s) downloaded` and rebuilds the same section count.
