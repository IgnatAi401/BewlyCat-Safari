// 页面脚本（MAIN world）中运行，不能使用扩展 API。
//
// style.css 里专为 B 站组件写的 `:host(bili-xxx)` 规则（src/styles/adaptedStyles/shadowDom/）
// 过去靠 Safari 把清单样式套进所有 Shadow DOM 才生效。清单不再注入样式后（见 pageStyles.ts），
// 在对应组件创建 Shadow DOM 时把这些规则直接插进去。上游修改这些规则时同步修改这里。
// 评论用户名和正文链接的主题色已由 pageBridge.ts 的补丁处理，不在此列。

const ADAPTED_SHADOW_STYLES: Record<string, string> = {
  'bili-comment-renderer': `
    #body .tag {
      color: var(--bew-comment-tag-color, var(--bili-comment-tag-color)) !important;
      background-color: var(--bew-comment-tag-bg, var(--bili-comment-tag-bg)) !important;
    }

    #body.dark .tag[style] {
      --bili-comment-tag-color: var(--bew-text-2);
      --bili-comment-tag-bg: var(--bew-fill-1);
    }
  `,
  'bili-user-profile': `
    #action button#follow:hover {
      background-color: var(--bew-theme-color-80);
      border-color: var(--bew-theme-color-80);
    }
  `,
}

export function installSafariAdaptedShadowStyles() {
  const originalAttachShadow = Element.prototype.attachShadow
  Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
    const root = originalAttachShadow.call(this, init)
    try {
      if (Object.hasOwn(ADAPTED_SHADOW_STYLES, this.localName)) {
        const style = document.createElement('style')
        style.setAttribute('data-bewly-safari-adapted-style', '')
        style.textContent = ADAPTED_SHADOW_STYLES[this.localName]
        root.appendChild(style)
      }
    }
    catch {
      // 样式补不上只影响外观，不能影响 B 站组件创建。
    }
    return root
  }
}
