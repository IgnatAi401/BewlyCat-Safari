// 内容脚本与页面脚本（MAIN world）之间的 Safari 专属桥接，不能使用扩展 API。

const THEME_CHANGE_REQUEST = 'bewlyBilibiliThemeChangeRequest'

// Safari 中内容脚本派发的事件不会被 B 站页面监听器处理，改由页面脚本派发。
export function requestSafariBilibiliThemeChange(theme: 'dark' | 'light') {
  window.postMessage({ type: THEME_CHANGE_REQUEST, theme }, window.location.origin)
}

export function setupSafariPageMessageBridge() {
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object')
      return

    const { type, theme } = event.data
    if (type === THEME_CHANGE_REQUEST && (theme === 'dark' || theme === 'light'))
      window.dispatchEvent(new CustomEvent('global.themeChange', { detail: theme }))
  })
}

// 评论区用户名跟随主题色。不能放进通用样式补丁表：页面脚本对表中组件只注入样式就返回，
// 会跳过 bili-comment-user-info 自己的性别、楼主标识、IP 属地处理，改在该处理开头注入。
export const SAFARI_COMMENT_USER_INFO_STYLE_PATCH = {
  id: 'bewly-comment-user-info-style',
  css: `
    #user-name a[style*="color"] {
      color: var(--bew-theme-color) !important;
    }
  `,
}

// 评论区链接跟随主题色。
export const SAFARI_COMMENT_SHADOW_STYLE_PATCHES: Record<string, { id: string, css: string }> = {
  'bili-rich-text': {
    id: 'bewly-comment-rich-text-style',
    css: `
      :host {
        --bili-rich-text-link-color: var(--bew-theme-color) !important;
        --bili-rich-text-link-color-hover: var(--bew-theme-color-80) !important;
      }

      #contents img[src*="AeQJlYP7e.png"],
      #contents img[src*="9f3ad0659e84c96a711b88dd33f4bc2e945045e0.png"] {
        filter: var(--bew-filter-icon-glow);
      }
    `,
  },
}
