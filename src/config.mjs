import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './paths.mjs'

export const CONFIG_PATH = process.env.PSE_CONFIG ?? join(ROOT, 'book.config.json')

export const DEFAULT_CONFIG = {
  creatorSlug: '',
  campaignId: '',
  title: '',
  author: '',
  outputName: 'book',
  anchorPostId: '',
  include: 'chapter|interlude|prologue|epilogue|part\\s+\\w+',
  exclude: 'poll|tour|kickstarter|merch|giveaway|q&a|announcement',
  extraPostIds: [],
  skipPostIds: [],
  collectionUrl: '',
  collectionOrder: 'published',
}

export const COLLECTION_ORDERS = ['published', 'collection', 'collection-reversed']

/** patreon.com/collection/<id> URL, or a bare id -> the numeric id, else null. */
export function collectionIdFrom(url) {
  const s = String(url).trim()
  return (/^(\d+)$/.exec(s) ?? /patreon\.com\/collection\/(\d+)/i.exec(s))?.[1] ?? null
}

export function configExists() {
  return existsSync(CONFIG_PATH)
}

export function loadConfig() {
  if (!configExists()) {
    throw new Error(
      `No config at ${CONFIG_PATH}.\n` +
        `Run the setup wizard first:  npm run init`,
    )
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  } catch (err) {
    throw new Error(`${CONFIG_PATH} is not valid JSON (${err.message}).\nFix it, or re-run:  npm run init`)
  }

  const cfg = { ...DEFAULT_CONFIG, ...parsed }
  cfg.collectionId = null
  if (cfg.collectionUrl) {
    cfg.collectionId = collectionIdFrom(cfg.collectionUrl)
    if (!cfg.collectionId) {
      throw new Error(
        `The "collectionUrl" in ${CONFIG_PATH} is not a Patreon collection link.\n` +
          'It should look like  https://www.patreon.com/collection/1234567',
      )
    }
    if (!COLLECTION_ORDERS.includes(cfg.collectionOrder)) {
      throw new Error(
        `The "collectionOrder" in ${CONFIG_PATH} must be one of: ${COLLECTION_ORDERS.join(', ')}.`,
      )
    }
  }
  // A collection decides where the book starts, so it needs no anchor post.
  const needed = cfg.collectionId ? ['campaignId', 'title'] : ['campaignId', 'anchorPostId', 'title']
  for (const required of needed) {
    if (!cfg[required]) {
      throw new Error(`${CONFIG_PATH} is missing "${required}". Re-run:  npm run init`)
    }
  }
  for (const pattern of ['include', 'exclude']) {
    try {
      new RegExp(cfg[pattern])
    } catch (err) {
      throw new Error(`The "${pattern}" pattern in ${CONFIG_PATH} is not a valid regex: ${err.message}`)
    }
  }
  return cfg
}

export function saveConfig(cfg) {
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n')
  return CONFIG_PATH
}
