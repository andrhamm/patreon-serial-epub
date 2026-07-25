/**
 * Patreon's own JSON:API, called from inside the page so requests carry the
 * logged-in cookie jar exactly as the site itself would send them.
 */
export async function apiGet(page, path) {
  if (!page.url().includes('patreon.com')) {
    await page.goto('https://www.patreon.com/', { waitUntil: 'domcontentloaded' })
  }
  const res = await page.evaluate(async (p) => {
    const r = await fetch(p, { headers: { accept: 'application/json' } })
    return { status: r.status, text: await r.text() }
  }, path)

  if (res.status === 401 || res.status === 403) {
    throw new Error('Patreon rejected the request — your session expired. Run:  npm run login')
  }
  if (res.status !== 200) {
    throw new Error(`Patreon returned HTTP ${res.status} for ${path.slice(0, 80)}`)
  }
  return JSON.parse(res.text)
}

/**
 * Follow cursor pagination until exhausted or `max` items collected.
 * Guards against a repeated cursor, which would otherwise loop forever.
 */
export async function apiGetAll(page, path, max = Infinity) {
  const items = []
  const seenUrls = new Set()
  let url = path

  while (url && items.length < max && !seenUrls.has(url)) {
    seenUrls.add(url)
    const body = await apiGet(page, url)
    items.push(...(body.data ?? []))

    const next = body.links?.next
    if (!next) break
    url = next.startsWith('http') ? new URL(next).pathname + new URL(next).search : next
  }

  return items.slice(0, max === Infinity ? undefined : max)
}
