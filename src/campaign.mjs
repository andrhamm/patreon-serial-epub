/** Resolve a creator's numeric campaign id from their patreon.com/<slug> page. */
export async function resolveCampaignId(page, slug) {
  const clean = String(slug).trim().replace(/^.*patreon\.com\//i, '').replace(/\/.*$/, '')
  const res = await page.goto(`https://www.patreon.com/${clean}/posts`, {
    waitUntil: 'domcontentloaded',
  })
  if (res?.status() !== 200) {
    throw new Error(`patreon.com/${clean} returned HTTP ${res?.status()} — check the creator's URL name.`)
  }

  const found = await page.evaluate(() => {
    const html = document.documentElement.innerHTML
    const hits = [
      ...html.matchAll(/"campaign"[^}]{0,80}?"id"\s*:\s*"?(\d{4,9})"?/g),
      ...html.matchAll(/campaign_id["=:\s%5D]+(\d{4,9})/g),
    ].map((m) => m[1])
    // Most-frequent id wins; stray ids appear in ads and recommendations.
    const tally = new Map()
    for (const id of hits) tally.set(id, (tally.get(id) ?? 0) + 1)
    return [...tally].sort((a, b) => b[1] - a[1]).map(([id]) => id)[0] ?? null
  })

  if (!found) {
    throw new Error(`Could not find a campaign id on patreon.com/${clean}.`)
  }
  return { slug: clean, campaignId: found, title: await page.title() }
}
