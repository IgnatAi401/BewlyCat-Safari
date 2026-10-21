// 由 manifest 生成脚本在 Node 中导入，只能使用相对路径且不能依赖扩展 API。
import type { Manifest } from 'webextension-polyfill'

import { CONTENT_SCRIPT_EXCLUDE_MATCHES } from '../constants/contentScript'
import { getSafariExtensionVersion } from './version'

// 只注入 BewlyCat 实际接管的页面，且不注入 iframe（抽屉打开方式因此不可用）。
const SAFARI_CONTENT_SCRIPT_MATCHES = [
  '*://www.bilibili.com/',
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
