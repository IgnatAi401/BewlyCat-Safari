// 独立设置页（dist/options）的 B 站 Cookie 快照。
//
// 上游设置页用 browser.cookies.getAll 读取 B 站 Cookie（扩展页的 document.cookie 读不到），
// 但 Safari 的 cookies API 读不到 B 站 Cookie，onChanged 回调也不带 changeInfo（上游监听里
// 解构 cookie 会报错）。Safari 版改为：设置页 -> 后台 -> 最近访问的 B 站标签页顶层框架，
// 由内容脚本读取 document.cookie（getUserID / getCSRF 需要的 DedeUserID、bili_jct 都不是
// HttpOnly）。没有打开的 B 站页面时快照为空，与未登录相同；设置页重新可见时再同步一次。
import type { Runtime } from 'webextension-polyfill'
import browser from 'webextension-polyfill'

import { CONTENT_SCRIPT_MATCHES } from '~/constants/contentScript'

export const SETTINGS_PAGE_COOKIES_MESSAGE = 'bewly-cat:safari:settings-page-cookies'
const TAB_COOKIES_MESSAGE = 'bewly-cat:safari:tab-cookies'

export type CookieEntries = Array<[string, string]>

function parseDocumentCookie(cookieText: string): CookieEntries {
  return cookieText.split(';').flatMap((part) => {
    const index = part.indexOf('=')
    if (index <= 0)
      return []
    return [[part.slice(0, index).trim(), part.slice(index + 1).trim()] as [string, string]]
  })
}

// 后台：转发给最近访问的 B 站标签页，只问顶层框架。
export function setupSafariSettingsPageCookieRelay() {
  browser.runtime.onMessage.addListener((message: any, sender: Runtime.MessageSender) => {
    if (message?.type !== SETTINGS_PAGE_COOKIES_MESSAGE)
      return undefined
    // 只应答扩展自己的页面。
    if (sender.tab?.url && !sender.tab.url.startsWith(browser.runtime.getURL('')))
      return undefined

    return (async (): Promise<CookieEntries> => {
      const tabs = await browser.tabs.query({ url: [...CONTENT_SCRIPT_MATCHES] }).catch(() => [])
      tabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
      for (const tab of tabs) {
        if (tab.id === undefined)
          continue
        try {
          const entries = await browser.tabs.sendMessage(tab.id, { type: TAB_COOKIES_MESSAGE }, { frameId: 0 })
          if (Array.isArray(entries))
            return entries as CookieEntries
        }
        catch {
          // 标签页已休眠或没有内容脚本，继续尝试下一个。
        }
      }
      return []
    })()
  })
}

// 内容脚本：应答后台的 Cookie 请求。
export function setupSafariTabCookieResponder() {
  if (window.top !== window)
    return
  browser.runtime.onMessage.addListener((message: any) => {
    if (message?.type !== TAB_COOKIES_MESSAGE)
      return undefined
    return Promise.resolve(parseDocumentCookie(document.cookie))
  })
}
