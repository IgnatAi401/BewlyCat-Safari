// Safari 的 cookies API 读不到 B 站 Cookie，后台改用 nav 接口得到当前登录账号。
const NAV_URL = 'https://api.bilibili.com/x/web-interface/nav'
const REQUEST_TIMEOUT_MS = 10_000

// 登录账号快照：已登录为 mid，未登录为 '0'；请求失败为 undefined。
export async function readSafariLoginSnapshot(): Promise<string | undefined> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(NAV_URL, { credentials: 'include', signal: controller.signal })
    const data = await response.json()
    if (data?.code !== 0 && data?.code !== -101)
      return undefined
    return data.data?.isLogin ? String(data.data.mid) : '0'
  }
  catch {
    return undefined
  }
  finally {
    clearTimeout(timeout)
  }
}

let cachedSnapshot: string | undefined
let pendingSnapshot: Promise<string | undefined> | undefined

// 由登录态监听更新；传入 undefined 表示可能已过期，下次使用时重新请求。
export function setSafariLoginSnapshot(snapshot: string | undefined) {
  cachedSnapshot = snapshot
}

// 接口缓存的账号键，对应其他浏览器读到的 DedeUserID，未登录时为空；无法确认时抛错，调用方不使用缓存。
export async function getSafariAccountId(): Promise<string> {
  if (cachedSnapshot === undefined) {
    pendingSnapshot ??= readSafariLoginSnapshot().finally(() => {
      pendingSnapshot = undefined
    })
    const snapshot = await pendingSnapshot
    cachedSnapshot ??= snapshot
  }
  if (cachedSnapshot === undefined)
    throw new Error('[BewlyCat] Cannot confirm the Bilibili account.')
  return cachedSnapshot === '0' ? '' : cachedSnapshot
}
