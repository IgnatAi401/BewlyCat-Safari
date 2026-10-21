// 由 manifest 生成脚本在 Node 中导入，只能使用相对路径且不能依赖扩展 API。
import type { Manifest } from 'webextension-polyfill'

import { CONTENT_SCRIPT_EXCLUDE_MATCHES } from '../constants/contentScript'
import { getSafariExtensionVersion } from './version'

// 只注入 BewlyCat 实际接管的页面，且不注入 iframe（抽屉打开方式因此不可用）。
const SAFARI_MAIN_SITE_PATH_MATCHES = [
  '*://www.bilibili.com/',
  // 带参数的首页（如 /?spm_id_from=...）：匹配模式的路径部分包含查询参数。
  '*://www.bilibili.com/?*',
  '*://www.bilibili.com/index.html*',
  '*://www.bilibili.com/video/*',
  '*://www.bilibili.com/list/*',
  '*://www.bilibili.com/bangumi/play/*',
  '*://www.bilibili.com/festival/*',
  '*://www.bilibili.com/watchlater*',
  '*://www.bilibili.com/v/*',
  '*://www.bilibili.com/c/*',
  '*://www.bilibili.com/anime*',
  '*://www.bilibili.com/guochuang*',
  '*://www.bilibili.com/tv*',
  '*://www.bilibili.com/movie*',
  '*://www.bilibili.com/variety*',
  '*://www.bilibili.com/mooc*',
  '*://www.bilibili.com/documentary*',
  '*://www.bilibili.com/opus/*',
  '*://www.bilibili.com/history*',
  '*://www.bilibili.com/account/history*',
  '*://www.bilibili.com/read/*',
  '*://www.bilibili.com/404*',
]

// 主站多语言页面在路径前加语言段（如 /ja/video/...），与 src/utils/bilibiliLocale.ts 的列表保持一致。
const BILIBILI_LOCALE_PATH_SEGMENTS = ['en', 'th', 'vi', 'id', 'ja', 'zh-hant', 'zh-hans', 'ar', 'pt', 'es', 'tr', 'ru', 'ms']

const MAIN_SITE_ORIGIN_MATCH = '*://www.bilibili.com'

function withLocalePaths(matches: string[]) {
  return matches.flatMap(match => [
    match,
    ...BILIBILI_LOCALE_PATH_SEGMENTS.map(locale => `${MAIN_SITE_ORIGIN_MATCH}/${locale}${match.slice(MAIN_SITE_ORIGIN_MATCH.length)}`),
  ])
}

const SAFARI_CONTENT_SCRIPT_MATCHES = [
  ...withLocalePaths(SAFARI_MAIN_SITE_PATH_MATCHES),
  // 多语言首页的 /ja（不带结尾斜杠）。
  ...BILIBILI_LOCALE_PATH_SEGMENTS.map(locale => `${MAIN_SITE_ORIGIN_MATCH}/${locale}`),
  '*://search.bilibili.com/*',
  '*://t.bilibili.com/*',
  '*://space.bilibili.com/*',
  '*://message.bilibili.com/*',
  '*://member.bilibili.com/platform*',
  '*://account.bilibili.com/*',
  '*://passport.bilibili.com/login*',
  '*://music.bilibili.com/pc/music-center*',
]

const SAFARI_CONTENT_SCRIPT_EXCLUDE_MATCHES = [
  ...CONTENT_SCRIPT_EXCLUDE_MATCHES,
  '*://t.bilibili.com/vote*',
  '*://t.bilibili.com/share*',
  '*://t.bilibili.com/pages/nav*',
]

export function applySafariManifest(manifest: Manifest.WebExtensionManifest, upstreamVersion: string) {
  manifest.version = getSafariExtensionVersion(upstreamVersion)

  // Safari 需要带主机权限的变体，请求头规则才会作用于 B 站接口。
  manifest.permissions = manifest.permissions?.map(permission =>
    permission === 'declarativeNetRequest' ? 'declarativeNetRequestWithHostAccess' : permission,
  )

  manifest.content_scripts = manifest.content_scripts?.map(script => ({
    ...script,
    matches: [...SAFARI_CONTENT_SCRIPT_MATCHES],
    exclude_matches: [...SAFARI_CONTENT_SCRIPT_EXCLUDE_MATCHES],
    all_frames: false,
  }))

  const record = manifest as Record<string, any>
  for (const resource of record.declarative_net_request?.rule_resources ?? []) {
    if (resource.path === 'assets/rules.json')
      resource.path = 'assets/rules-safari.json'
  }

  record.browser_specific_settings = {
    safari: {
      strict_min_version: '18.4',
    },
  }
}
