import { apiGetAll } from './api.mjs'

const FIELDS = ['title', 'published_at', 'url', 'post_type', 'current_user_can_view']

/**
 * Post metadata, newest first.
 * Page size stays small on purpose: larger pages came back truncated to a
 * stale window (months old) rather than erroring.
 */
export function postsPath(campaignId, count = 20) {
  return (
    `/api/posts?filter%5Bcampaign_id%5D=${encodeURIComponent(campaignId)}` +
    `&sort=-published_at` +
    `&fields%5Bpost%5D=${FIELDS.map(encodeURIComponent).join('%2C')}` +
    `&page%5Bcount%5D=${count}` +
    `&json-api-version=1.0&json-api-use-default-includes=false&include=%5B%5D`
  )
}

export async function listPosts(page, campaignId, { max = Infinity } = {}) {
  const raw = await apiGetAll(page, postsPath(campaignId), max)
  return raw.map((p) => ({
    id: p.id,
    title: (p.attributes?.title ?? '(untitled)').trim(),
    publishedAt: p.attributes?.published_at ?? '',
    url: p.attributes?.url ?? '',
    type: p.attributes?.post_type ?? '',
    canView: p.attributes?.current_user_can_view !== false,
  }))
}
