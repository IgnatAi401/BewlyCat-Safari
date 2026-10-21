// Safari 在系统设置为「始终显示滚动条」（或连接鼠标）时使用占位的传统滚动条，
// 右侧会一直留出滚动条宽度，把整个界面往左挤。Safari 下隐藏这些滚动条并取消预留宽度，
// 滚轮、触控板和键盘滚动不受影响。

// 主界面滚动容器 `.bewly-scroll-viewport` 设有 `scrollbar-gutter: stable`。
export function hideSafariScrollViewportScrollbar(viewport: HTMLElement) {
  viewport.style.setProperty('scrollbar-width', 'none')
  viewport.style.setProperty('scrollbar-gutter', 'auto')
}

// 播放页等由文档自身滚动的页面：隐藏页面右侧滚动条。
const PAGE_SCROLLBAR_STYLE_ID = 'bewly-safari-hide-page-scrollbar'
const PAGE_SCROLLBAR_CSS = 'html{scrollbar-width:none!important;scrollbar-gutter:auto!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important}'

export function hideSafariPageScrollbar() {
  if (document.getElementById(PAGE_SCROLLBAR_STYLE_ID))
    return

  const style = document.createElement('style')
  style.id = PAGE_SCROLLBAR_STYLE_ID
  style.textContent = PAGE_SCROLLBAR_CSS
  document.documentElement.appendChild(style)
}
