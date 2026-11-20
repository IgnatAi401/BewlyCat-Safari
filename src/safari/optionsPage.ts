// 独立设置页（dist/options）中运行，说明见 settingsPageCookies.ts。
import browser from 'webextension-polyfill'

import { localSettingsReady, settingsReady } from '~/logic'
import { setBilibiliCookieSnapshot } from '~/utils/main'

import type { CookieEntries } from './settingsPageCookies'
import { SETTINGS_PAGE_COOKIES_MESSAGE } from './settingsPageCookies'

async function syncSafariSettingsPageCookies() {
  try {
    const entries = await browser.runtime.sendMessage({ type: SETTINGS_PAGE_COOKIES_MESSAGE }) as CookieEntries | undefined
    setBilibiliCookieSnapshot(new Map(Array.isArray(entries) ? entries : []))
  }
  catch (error) {
    console.error('[BewlyCat] 读取 B 站 Cookie 失败:', error)
  }
}

// 设置页：替代上游 bootstrap()，不注册 cookies.onChanged。
export async function bootstrapSafariOptionsPage(mount: () => void) {
  setBilibiliCookieSnapshot(new Map())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      void syncSafariSettingsPageCookies()
  })

  await Promise.all([settingsReady, localSettingsReady, syncSafariSettingsPageCookies()])
  mount()
}
