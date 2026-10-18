import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const PROFILE_DIR = join(ROOT, '.auth', 'ff-profile')
export const HOME_DIR = join(ROOT, '.auth', 'ff-home')
export const RAW_DIR = join(ROOT, 'content', 'posts')
export const CH_DIR = join(ROOT, 'content', 'chapters')
export const OUT_DIR = join(ROOT, 'out')
