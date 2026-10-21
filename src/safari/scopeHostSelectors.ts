// Safari 会把清单注入的内容脚本样式（style.css）同时应用到页面上所有 Shadow DOM 内部，
// 其中只为 BewlyCat 容器（#bewly）编写的 `:host` 规则会命中 B 站评论等组件：
// `:host, :root` 的浅色变量直接写在组件宿主上，深色模式下盖过从页面继承来的深色变量。
// Safari 构建时把这些 `:host` 限定到 #bewly；`:host(bili-xxx)` 这类专门适配 B 站组件的规则保持不变。

const BEWLY_HOST_ID = 'bewly'

// 匹配 `:host` 与参数不含括号的 `:host(...)`，不匹配 `:host-context(...)`。
const HOST_SELECTOR_PATTERN = /:host(?:\(([^()]*)\))?(?![\w(-])/g

export function scopeSafariHostSelector(selector: string): string {
  return selector.replace(HOST_SELECTOR_PATTERN, (match, argument: string | undefined) => {
    if (argument === undefined)
      return `:host(#${BEWLY_HOST_ID})`

    const trimmed = argument.trim()
    // 以标签名开头的参数（如 `bili-user-profile`）是有意适配 B 站组件的规则。
    if (/^[a-z]/i.test(trimmed))
      return match

    return `:host(#${BEWLY_HOST_ID}${trimmed})`
  })
}

export function scopeSafariHostSelectors() {
  return {
    postcssPlugin: 'bewly-safari-scope-host-selectors',
    Rule(rule: { selector: string }) {
      if (rule.selector.includes(':host'))
        rule.selector = scopeSafariHostSelector(rule.selector)
    },
  }
}
