// 页面脚本（MAIN world）中运行，不能使用扩展 API。
//
// BewlyCat 接管首页时只用 CSS 隐藏 B 站原首页（html.bewly-custom-homepage），原首页的应用仍在运行：
// 隐藏后容器高度为 0，信息流一直判定已滚到底部，加载后约 9 秒内连续请求 10 页推荐、
// 渲染约 8000 个不可见节点并下载约 200 张封面。隐藏期间暂缓这些请求；切回原版首页
// （设置中改用原版首页时类名被移除、原首页直接显示）后再发出，原首页照常加载。
const HIDDEN_HOMEPAGE_CLASS = 'bewly-custom-homepage'
const FEED_API_PATTERN = /\/x\/web-interface\/(?:wbi\/)?index\/top\/feed\/rcmd/

function isOriginalHomepageHidden(): boolean {
  return !!document.documentElement?.classList.contains(HIDDEN_HOMEPAGE_CLASS)
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string')
    return input
  if (input instanceof URL)
    return input.href
  return input.url
}

let homepageShown: Promise<void> | undefined

function waitUntilOriginalHomepageShown(): Promise<void> {
  homepageShown ??= new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (isOriginalHomepageHidden())
        return
      observer.disconnect()
      homepageShown = undefined
      resolve()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })
  return homepageShown
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

// 等待期间请求被页面取消时按 fetch 的行为立即失败。
function waitWithSignal(promise: Promise<void>, signal?: AbortSignal | null): Promise<void> {
  if (!signal)
    return promise
  if (signal.aborted)
    return Promise.reject(abortReason(signal))
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    })
  })
}

export function deferSafariHiddenHomepageFeed() {
  if (window !== window.top || location.hostname !== 'www.bilibili.com')
    return

  const originalFetch = window.fetch
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (!isOriginalHomepageHidden() || !FEED_API_PATTERN.test(getRequestUrl(input)))
      return originalFetch.call(this, input, init)

    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    return waitWithSignal(waitUntilOriginalHomepageShown(), signal)
      .then(() => originalFetch.call(this, input, init))
  }
}
