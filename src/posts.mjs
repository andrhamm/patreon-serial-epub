import { apiGet, apiGetAll } from './api.mjs'

const FIELDS = ['title', 'published_at', 'url', 'post_type', 'current_user_can_view']

/**
 * Post metadata, newest first — or, given a collection, that collection's
 * posts in the order the creator arranged them.
 * Page size stays small on purpose: larger pages came back truncated to a
 * stale window (months old) rather than erroring.
 */
export function postsPath(campaignId, count = 20, { collectionId } = {}) {
  // The collection filter is rejected without campaign_id, and only
  // `collection_order` sorts it (its reverse is rejected too).
  const scope = collectionId
    ? `&filter%5Bcollection_id%5D=${encodeURIComponent(collectionId)}&sort=collection_order`
    : `&sort=-published_at`
  return (
    `/api/posts?filter%5Bcampaign_id%5D=${encodeURIComponent(campaignId)}` +
    scope +
    `&fields%5Bpost%5D=${FIELDS.map(encodeURIComponent).join('%2C')}` +
    `&page%5Bcount%5D=${count}` +
    `&json-api-version=1.0&json-api-use-default-includes=false&include=%5B%5D`
  )
}

const toPost = (p) => ({
  id: p.id,
  title: (p.attributes?.title ?? '(untitled)').trim(),
  publishedAt: p.attributes?.published_at ?? '',
  url: p.attributes?.url ?? '',
  type: p.attributes?.post_type ?? '',
  canView: p.attributes?.current_user_can_view !== false,
})

export async function listPosts(page, campaignId, { max = Infinity, collectionId } = {}) {
  const raw = await apiGetAll(page, postsPath(campaignId, 20, { collectionId }), max)
  return raw.map(toPost)
}

/** Metadata for one post named by id rather than found in a listing. */
export async function getPost(page, id) {
  const body = await apiGet(
    page,
    `/api/posts/${encodeURIComponent(id)}` +
      `?fields%5Bpost%5D=${FIELDS.map(encodeURIComponent).join('%2C')}` +
      `&json-api-version=1.0&json-api-use-default-includes=false&include=%5B%5D`,
  )
  return toPost(body.data)
}

/** Collection posts (as listed by Patreon) in the reading order a config asks for. */
export function orderCollection(posts, order) {
  if (order === 'collection') return [...posts]
  if (order === 'collection-reversed') return [...posts].reverse()
  // Ties broken by id so ordering never depends on the order the API replied in.
  return [...posts].sort(
    (a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id),
  )
}

/**
 * A collection-mode book before skips: the collection's posts plus any
 * extraPostIds it is missing, in the config's reading order. Posts that came
 * from extraPostIds are tagged `extra`.
 */
export async function listCollection(page, cfg) {
  const listed = await listPosts(page, cfg.campaignId, { collectionId: cfg.collectionId })
  if (listed.length === 0) {
    throw new Error(
      `Collection ${cfg.collectionId} has no posts you can see.\n` +
        'Check that "collectionUrl" and "campaignId" in your config belong to the same creator.',
    )
  }

  const have = new Set(listed.map((p) => p.id))
  const missing = [...new Set(cfg.extraPostIds ?? [])].filter((id) => !have.has(id))
  // Only a date says where an added post belongs; a creator's own
  // arrangement has no slot for a post it doesn't contain.
  if (missing.length && cfg.collectionOrder !== 'published') {
    throw new Error(
      `extraPostIds can only add posts to a collection when "collectionOrder" is "published".\n` +
        `With "${cfg.collectionOrder}" there is no way to tell where they belong. ` +
        'Ask the creator to add them to the collection, or switch to "published".',
    )
  }

  const extras = []
  for (const id of missing) {
    await page.waitForTimeout(1200) // stay gentle on the API
    try {
      extras.push({ ...(await getPost(page, id)), extra: true })
    } catch (err) {
      throw new Error(`Could not load post ${id} from extraPostIds.\n${err.message}`)
    }
  }
  return orderCollection([...listed, ...extras], cfg.collectionOrder)
}
