import { apiGetAll } from './api.mjs'

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

export async function listPosts(page, campaignId, { max = Infinity, collectionId } = {}) {
  const raw = await apiGetAll(page, postsPath(campaignId, 20, { collectionId }), max)
  return raw.map((p) => ({
    id: p.id,
    title: (p.attributes?.title ?? '(untitled)').trim(),
    publishedAt: p.attributes?.published_at ?? '',
    url: p.attributes?.url ?? '',
    type: p.attributes?.post_type ?? '',
    canView: p.attributes?.current_user_can_view !== false,
  }))
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
