import browser from 'webextension-polyfill'

import type { SafariRelease, SafariUpdateCache, SafariUpdateState } from './shared'
import {
  compareVersions,
  parseSafariTag,
  readPrefs,
  SAFARI_LATEST_RELEASE_API,
  SAFARI_RELEASES_URL,
  SAFARI_REPO_URL,
  UPDATE_CACHE_KEY,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_CHECK_NOW_MESSAGE,
  UPDATE_GET_STATE_MESSAGE,
} from './shared'

const FETCH_TIMEOUT_MS = 10_000
const RETRY_AFTER_FAILURE_MS = 60 * 60 * 1000
const SUMMARY_MAX_LENGTH = 160

let pendingCheck: Promise<SafariUpdateCache | undefined> | undefined

// 取说明正文前几行作为摘要，去掉 Markdown 标记。
function summarize(body: unknown): string {
  if (typeof body !== 'string')
    return ''
  const text = body
    .split('\n')
    .map(line => line.replace(/^[#>*\-\s]+/, '').replace(/[`*_]|\[([^\]]*)\]\([^)]*\)/g, '$1').trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
  return text.length > SUMMARY_MAX_LENGTH ? `${text.slice(0, SUMMARY_MAX_LENGTH)}…` : text
}

async function fetchLatestRelease(): Promise<SafariRelease | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(SAFARI_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
    // 尚无正式 Release 时返回 404，视为没有新版本。
    if (response.status === 404)
      return undefined
    if (!response.ok)
      throw new Error(`GitHub responded ${response.status}`)

    const data = await response.json() as Record<string, unknown>
    const version = parseSafariTag(data.tag_name)
    if (!version || data.draft === true || data.prerelease === true)
      return undefined

    const url = typeof data.html_url === 'string' && data.html_url.startsWith(`${SAFARI_REPO_URL}/`)
      ? data.html_url
      : SAFARI_RELEASES_URL
    return {
      version,
      tag: String(data.tag_name),
      name: typeof data.name === 'string' && data.name ? data.name : String(data.tag_name),
      url,
      summary: summarize(data.body),
    }
  }
  finally {
    clearTimeout(timeout)
  }
}

async function readCache(): Promise<SafariUpdateCache | undefined> {
  const stored = (await browser.storage.local.get(UPDATE_CACHE_KEY))[UPDATE_CACHE_KEY] as SafariUpdateCache | undefined
  return stored && typeof stored.checkedAt === 'number' ? stored : undefined
}

function isStale(cache: SafariUpdateCache | undefined) {
  return !cache || Date.now() >= (cache.nextCheckAt ?? cache.checkedAt + UPDATE_CHECK_INTERVAL_MS)
}

// 请求失败时返回 undefined，保留旧结果并在 1 小时后才允许自动重试。
function checkForUpdate(): Promise<SafariUpdateCache | undefined> {
  pendingCheck ??= (async () => {
    try {
      const now = Date.now()
      const cache: SafariUpdateCache = { checkedAt: now, nextCheckAt: now + UPDATE_CHECK_INTERVAL_MS, latest: await fetchLatestRelease() }
      await browser.storage.local.set({ [UPDATE_CACHE_KEY]: cache })
      return cache
    }
    catch (error) {
      console.warn('[BewlyCat Safari] Update check failed.', error)
      const previous = await readCache().catch(() => undefined)
      await browser.storage.local.set({
        [UPDATE_CACHE_KEY]: { checkedAt: previous?.checkedAt ?? 0, latest: previous?.latest, nextCheckAt: Date.now() + RETRY_AFTER_FAILURE_MS },
      }).catch(() => {})
      return undefined
    }
    finally {
      pendingCheck = undefined
    }
  })()
  return pendingCheck
}

async function getState(force: boolean): Promise<SafariUpdateState> {
  const prefs = await readPrefs()
  const currentVersion = browser.runtime.getManifest().version
  let cache = await readCache()
  let failed = false

  if (force || (prefs.enabled && isStale(cache))) {
    const fresh = await checkForUpdate()
    if (fresh)
      cache = fresh
    else
      failed = true
  }

  const latest = cache?.latest
  const hasUpdate = !!latest && compareVersions(latest.version, currentVersion) > 0
  const shouldNotify = prefs.enabled && hasUpdate
    && latest!.version !== prefs.ignoredVersion
    && Date.now() >= (prefs.snoozedUntil ?? 0)

  return { enabled: prefs.enabled, currentVersion, checkedAt: cache?.checkedAt, latest, hasUpdate, shouldNotify, failed }
}

export function setupSafariUpdateCheck() {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== 'object' || message === null || !('type' in message))
      return undefined
    if (message.type === UPDATE_GET_STATE_MESSAGE)
      return getState(false)
    if (message.type === UPDATE_CHECK_NOW_MESSAGE)
      return getState(true)
    return undefined
  })

  // 后台页面启动时检查一次；之后由页面请求触发，超过 12 小时才重新请求。
  void getState(false).catch(() => {})
}
