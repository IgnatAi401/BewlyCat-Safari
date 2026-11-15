// 内容脚本中运行。
//
// Safari 把清单（manifest）注入的内容脚本样式套用到页面上每一个 Shadow DOM，而不只是主文档。
// B 站评论区每种组件（楼层、回复、用户信息、按钮、头像、图标……）各有一个 Shadow DOM，
// WebKit 要为每一种把整份 style.css（约 1.1 MB）重新建一遍样式规则集：评论首次出现时
// 卡顿数百毫秒，是 Safari 上评论区滚动和打开视频页卡顿的主要来源。
//
// Safari 构建不再通过清单注入 style.css（见 manifest.ts），改由内容脚本在 document_start
// 把同一份样式作为 <style> 插到 <html> 的最前面：只作用于主文档，层叠顺序与清单注入时一致
// （清单注入的样式是作者级、排在页面所有样式之前）。
// #bewly 自己的 Shadow DOM 仍由内容脚本单独注入样式，不受影响。

const PAGE_STYLE_ATTRIBUTE = 'data-bewly-page-styles'

// UnoCSS 的预设规则 `*, ::before, ::after { --un-rotate: 0; … }` 给页面上每个元素和伪元素
// 都写入约 50 个自定义属性。未注册的自定义属性默认会继承，于是每个元素都带一份自己的
// 「继承变量表」（扩展在根节点上还定义了 500 多个 `--bew-*` 变量，都在这张表里）。WebKit 重算
// 一个元素的样式后要比较新旧样式，变量表不是同一份时只能逐项比对，页面上每个元素都要付这笔账。
//
// 主文档中把这条规则换成等价的 `@property` 注册（不继承、初始值相同）：每个元素仍能读到同样的
// 默认值，但不再逐元素写入，子元素直接共用父元素的变量表。`@property` 对整个页面（含 Shadow DOM）
// 生效。视频页加载 20 楼评论后强制整页重算样式：有通配规则 86 ms，换成 `@property` 后 68 ms。
const UNO_PREFLIGHT_RULE_PATTERN = /(?:\*,::?before,::?after|::backdrop)\{((?:--un-[\w-]+:[^;{}]*;?)+)\}/g
const UNO_PREFLIGHT_DECLARATION_PATTERN = /(--un-[\w-]+):([^;{}]*)/g

// #bewly 的 Shadow DOM 用同一份样式文本。`@property` 已在主文档注册并对 Shadow DOM 同样生效，
// 这里只需去掉通配规则：扩展界面的每个元素不再各自携带一份变量副本（整页重算样式时
// 扩展界面部分从约 12 ms 降到约 5 ms）。
export function removeSafariUnoPreflight(cssText: string): string {
  return cssText.replace(UNO_PREFLIGHT_RULE_PATTERN, '')
}

export function replaceUnoPreflightWithRegisteredProperties(cssText: string): string {
  const initialValues = new Map<string, string>()
  const stripped = cssText.replace(UNO_PREFLIGHT_RULE_PATTERN, (_rule, declarations: string) => {
    for (const [, name, value] of declarations.matchAll(UNO_PREFLIGHT_DECLARATION_PATTERN)) {
      if (!initialValues.has(name))
        initialValues.set(name, value.trim())
    }
    return ''
  })
  if (initialValues.size === 0)
    return cssText

  const registrations = [...initialValues]
    .map(([name, value]) => `@property ${name}{syntax:"*";inherits:false;initial-value:${value};}`)
    .join('')
  return registrations + stripped
}

export function injectSafariPageStyles(cssText: string | undefined) {
  if (!cssText)
    return

  const pageCssText = replaceUnoPreflightWithRegisteredProperties(cssText)
  const insert = (): boolean => {
    const root = document.documentElement
    if (!root)
      return false
    if (root.querySelector(`:scope > style[${PAGE_STYLE_ATTRIBUTE}]`))
      return true

    const style = document.createElement('style')
    style.setAttribute(PAGE_STYLE_ATTRIBUTE, '')
    style.textContent = pageCssText
    root.insertBefore(style, root.firstChild)
    return true
  }

  if (insert())
    return

  // document_start 时 <html> 可能尚未创建。
  const observer = new MutationObserver(() => {
    if (insert())
      observer.disconnect()
  })
  observer.observe(document, { childList: true })
}
